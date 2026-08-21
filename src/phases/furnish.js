// Phase 4 — put the finished pieces in the room. Rotation is limited to 90°
// steps, which keeps every footprint axis aligned and makes the clearance rules
// exact rather than approximate.

import * as THREE from 'three';
import { MM, clamp } from '../core/util.js';
import { getKit } from '../content/catalog.js';
import { buildPart, placeAt } from '../render/partmesh.js';
import { h } from '../ui/dom.js';
import { state, save } from '../core/store.js';

const SNAP = 25;                       // mm grid the pieces snap to

export function mountFurnish({ stage, root, flat, onDone, onBack }) {
  const room = flat.bedroom;
  let floorPlane;
  const world = new THREE.Group();
  stage.world.add(world);
  stage.setBackground(0x0e1218);
  stage.grid.visible = false;
  stage.floor.visible = false;

  const pieces = state.owned.filter((o) => o.built && getKit(o.kitId)).map((o) => {
    const kit = getKit(o.kitId);
    const saved = state.layout[o.kitId];
    return {
      kitId: o.kitId, kit, result: o.result,
      x: saved?.x ?? 0, z: saved?.z ?? 0, rot: saved?.rot ?? 0,
      group: null,
    };
  });

  buildRoom();
  pieces.forEach(buildPiece);
  layoutInitial();

  let selected = null;
  let dragging = null;

  // ------------------------------------------------------------------ UI ----
  const panel = h('div', 'screen furnish-ui');
  root.append(panel);
  const card = h('div', 'card furnish-card');
  panel.append(card);
  const foot = h('div', 'furnish-foot');
  panel.append(foot);

  function render() {
    card.innerHTML = '';
    card.append(h('h2', null, 'Where does it go?'));
    card.append(h('p', 'muted', 'Pick a piece, drag it across the floor, and turn it a quarter turn at a time. The rules below are the ones you will actually notice living here.'));
    const list = h('div', 'piece-list');
    const report = evaluate();
    for (const p of pieces) {
      const row = h('button', `piece-row${selected === p ? ' on' : ''}`);
      const issues = report.issues.filter((i) => i.kitId === p.kitId);
      row.innerHTML = `<b>${p.kit.name}</b><span class="muted">${p.kit.product}</span>
        <span class="tick ${issues.length ? 'no' : 'ok'}">${issues.length ? `${issues.length} problem${issues.length > 1 ? 's' : ''}` : 'clear'}</span>`;
      row.onclick = () => { selected = p; frameOn(p); render(); };
      list.append(row);
    }
    card.append(list);

    // Turning was R-only, which leaves a phone with no way to do it at all.
    const turn = h('button', 'btn ghost', 'Turn it 90°');
    turn.disabled = !selected;
    turn.onclick = () => turnSelected();
    turn.append(h('span', 'act-key', 'R'));
    turn.classList.add('turn-btn');
    card.append(turn);

    const rules = h('ul', 'rules');
    for (const r of report.rules) {
      const li = h('li', r.ok ? 'ok' : 'no');
      li.innerHTML = `<span>${r.ok ? '✓' : '✗'}</span><b>${r.label}</b><i>${r.detail}</i>`;
      rules.append(li);
    }
    card.append(rules);

    foot.innerHTML = '';
    const score = h('div', 'furnish-score');
    score.innerHTML = `<b>${report.score}</b><span>layout score</span>`;
    const done = h('button', 'btn primary', 'This will do');
    done.onclick = () => finish(report);
    const back = h('button', 'btn ghost', 'Back to the workbench');
    back.onclick = onBack;
    foot.append(score, done, back);
  }

  // --------------------------------------------------------------- world ----

  function buildRoom() {
    const w = room.w * MM, d = room.d * MM, ch = room.ceiling * MM;
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(w, ch, d),
      new THREE.MeshStandardMaterial({ color: 0xd9d4c9, side: THREE.BackSide, roughness: 0.95 }),
    );
    shell.position.y = ch / 2;
    world.add(shell);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xa9803f, roughness: 0.7 }),
    );
    floor.position.y = 0.002;
    floor.userData.pick = { kind: 'floor' };
    world.add(floor);
    floorPlane = floor;

    world.add(wallFeature(room.window, 0x9fd8ff, 1300, room.window.sill));
    world.add(wallFeature(room.radiator, 0xcfcfcf, 600, 120));
    world.add(wallFeature(room.door, 0x6b4a2f, 2050, 0));
  }

  /** A window, radiator or door drawn flat on the wall it belongs to. */
  function wallFeature(f, colour, height, sill) {
    const g = new THREE.Group();
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(f.width * MM, height * MM),
      new THREE.MeshStandardMaterial({ color: colour, roughness: 0.6, side: THREE.DoubleSide }),
    );
    const { x, z, ry } = wallPoint(f.wall, f.at);
    plane.position.set(x, (sill + height / 2) * MM, z);
    plane.rotation.y = ry;
    g.add(plane);
    return g;
  }

  function wallPoint(wall, at) {
    const w = room.w * MM, d = room.d * MM, a = at * MM;
    if (wall === 'north') return { x: a - w / 2, z: -d / 2 + 0.01, ry: 0 };
    if (wall === 'south') return { x: a - w / 2, z: d / 2 - 0.01, ry: Math.PI };
    if (wall === 'west') return { x: -w / 2 + 0.01, z: a - d / 2, ry: Math.PI / 2 };
    return { x: w / 2 - 0.01, z: a - d / 2, ry: -Math.PI / 2 };
  }

  function buildPiece(p) {
    const g = new THREE.Group();
    for (const slot of p.kit.slots) {
      const part = p.kit.parts.find((x) => x.id === slot.part);
      const m = buildPart(part, [], {});
      placeAt(m, slot.pos, slot.rot);
      g.add(m);
    }
    // pieces are authored centred on their own footprint, sitting on the floor
    const box = new THREE.Box3().setFromObject(g);
    g.userData.pick = { kind: 'piece', id: p.kitId };
    g.userData.height = box.max.y;
    p.group = g;
    world.add(g);
  }

  function footprint(p) {
    const swap = p.rot % 180 !== 0;
    const w = swap ? p.kit.assembled.d : p.kit.assembled.w;
    const d = swap ? p.kit.assembled.w : p.kit.assembled.d;
    return { x0: p.x - w / 2, x1: p.x + w / 2, z0: p.z - d / 2, z1: p.z + d / 2, w, d };
  }

  /** Clearance zones in room coordinates, already rotated with the piece. */
  function zones(p) {
    const fp = footprint(p);
    return (p.kit.clearance ?? []).map((c) => {
      const dir = ((({ front: 0, left: 90, back: 180, right: 270 })[c.face] ?? 0) + p.rot) % 360;
      const depth = c.depth ?? 0;
      if (!depth) return null;
      if (dir === 0) return { ...c, x0: fp.x0, x1: fp.x1, z0: fp.z1, z1: fp.z1 + depth };
      if (dir === 180) return { ...c, x0: fp.x0, x1: fp.x1, z0: fp.z0 - depth, z1: fp.z0 };
      if (dir === 90) return { ...c, x0: fp.x1, x1: fp.x1 + depth, z0: fp.z0, z1: fp.z1 };
      return { ...c, x0: fp.x0 - depth, x1: fp.x0, z0: fp.z0, z1: fp.z1 };
    }).filter(Boolean);
  }

  function place(p) {
    p.group.position.set(p.x * MM, 0, p.z * MM);
    p.group.rotation.y = (p.rot * Math.PI) / 180;
    state.layout[p.kitId] = { x: p.x, z: p.z, rot: p.rot };
    stage.requestRender();
  }

  function layoutInitial() {
    let cursor = -room.w / 2 + 400;
    for (const p of pieces) {
      if (state.layout[p.kitId]) { place(p); continue; }
      p.x = clamp(cursor, -room.w / 2 + p.kit.assembled.w / 2, room.w / 2 - p.kit.assembled.w / 2);
      p.z = -room.d / 2 + p.kit.assembled.d / 2 + 40;
      p.rot = 0;
      cursor += p.kit.assembled.w + 300;
      place(p);
    }
  }

  // -------------------------------------------------------------- scoring ---

  const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0))
    * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));

  function featureRect(f, depth) {
    const half = f.width / 2;
    const W = room.w / 2, D = room.d / 2;
    if (f.wall === 'north') return { x0: f.at - W - half, x1: f.at - W + half, z0: -D, z1: -D + depth };
    if (f.wall === 'south') return { x0: f.at - W - half, x1: f.at - W + half, z0: D - depth, z1: D };
    if (f.wall === 'west') return { x0: -W, x1: -W + depth, z0: f.at - D - half, z1: f.at - D + half };
    return { x0: W - depth, x1: W, z0: f.at - D - half, z1: f.at - D + half };
  }

  function evaluate() {
    const issues = [];
    const W = room.w / 2, D = room.d / 2;
    const doorSwing = featureRect(room.door, room.door.width);
    const radiator = featureRect(room.radiator, 300);
    const windowRect = featureRect(room.window, 200);

    for (const p of pieces) {
      const fp = footprint(p);
      if (fp.x0 < -W || fp.x1 > W || fp.z0 < -D || fp.z1 > D) {
        issues.push({ kitId: p.kitId, rule: 'walls', text: `${p.kit.name} is through the wall.` });
      }
      for (const q of pieces) {
        if (q === p) continue;
        if (overlap(fp, footprint(q)) > 0) issues.push({ kitId: p.kitId, rule: 'collide', text: `${p.kit.name} is inside ${q.kit.name}.` });
      }
      if (overlap(fp, doorSwing) > 0) issues.push({ kitId: p.kitId, rule: 'door', text: `${p.kit.name} is in the door swing.` });
      if (overlap(fp, radiator) > 0 && p.kit.assembled.h > 600) issues.push({ kitId: p.kitId, rule: 'radiator', text: `${p.kit.name} is boxing in the radiator.` });
      if (overlap(fp, windowRect) > 0 && p.kit.assembled.h > room.window.sill) {
        issues.push({ kitId: p.kitId, rule: 'window', text: `${p.kit.name} covers the window.` });
      }
      for (const z of zones(p)) {
        const blocked = pieces.some((q) => q !== p && overlap(z, footprint(q)) > 0)
          || z.x0 < -W || z.x1 > W || z.z0 < -D || z.z1 > D;
        if (blocked) issues.push({ kitId: p.kitId, rule: 'clearance', text: `${p.kit.name} has no room to ${z.why}.` });
      }
    }

    const seen = new Set();
    const uniq = issues.filter((i) => { const k = `${i.kitId}:${i.rule}`; if (seen.has(k)) return false; seen.add(k); return true; });
    const ruleDefs = [
      ['walls', 'Everything is inside the room'],
      ['collide', 'Nothing overlaps'],
      ['door', 'The door still opens'],
      ['clearance', 'Doors and drawers have room to open'],
      ['radiator', 'The radiator is not boxed in'],
      ['window', 'The window is clear'],
    ];
    const rules = ruleDefs.map(([id, label]) => {
      const bad = uniq.filter((i) => i.rule === id);
      return { id, label, ok: !bad.length, detail: bad.length ? bad.map((b) => b.text).join(' ') : 'good' };
    });
    const score = Math.max(0, 100 - uniq.length * 14);
    return { issues: uniq, rules, score };
  }

  function finish(report) {
    save();
    const wrap = h('div', 'overlay');
    const c = h('div', 'card overlay-card');
    const built = state.owned.filter((o) => o.built);
    const avg = Math.round(built.reduce((a, o) => a + o.result.score, 0) / Math.max(1, built.length));
    c.innerHTML = `<h2>Moved in</h2>
      <p class="muted">${flat.name} — ${built.length} piece${built.length > 1 ? 's' : ''} built and placed.</p>
      <div class="facts">
        <div><b>${avg}</b><span>average build score</span></div>
        <div><b>${report.score}</b><span>layout score</span></div>
        <div><b>${Math.round((avg + report.score) / 2)}</b><span>overall</span></div>
      </div>`;
    const list = h('ul', 'notes');
    built.forEach((o) => list.append(h('li', null, `${getKit(o.kitId).name} — grade ${o.result.grade}, stiffness ${Math.round(o.result.stiffness * 100)}%, ${o.result.damage} damaged fastener${o.result.damage === 1 ? '' : 's'}`)));
    if (report.issues.length) report.issues.forEach((i) => list.append(h('li', 'bad', i.text)));
    c.append(list);
    const row = h('div', 'overlay-actions');
    const again = h('button', 'btn primary', 'Back to the flat');
    again.onclick = () => { wrap.remove(); };
    const done = h('button', 'btn ghost', 'Finish');
    done.onclick = () => { wrap.remove(); onDone(report); };
    row.append(again, done);
    c.append(row);
    wrap.append(c);
    root.append(wrap);
  }

  // ---------------------------------------------------------------- input ---

  const canvas = stage.renderer.domElement;
  const frameOn = (p) => stage.frameObject(p.group, { azimuth: 0.9, elevation: 0.55, pad: 2.6 });

  function onDown(e) {
    const hit = stage.pick(e, [world]);
    const pick = hit?.object.userData.pick;
    if (pick?.kind === 'piece') {
      selected = pieces.find((p) => p.kitId === pick.id);
      dragging = { piece: selected, dx: selected.x - hit.point.x / MM, dz: selected.z - hit.point.z / MM };
      stage.controls.enabled = false;
      render();
    }
  }

  function onMove(e) {
    if (!dragging) return;
    const hit = stage.pick(e, [floorPlane]);
    if (!hit) return;
    const p = dragging.piece;
    const fp = footprint(p);
    p.x = Math.round((hit.point.x / MM + dragging.dx) / SNAP) * SNAP;
    p.z = Math.round((hit.point.z / MM + dragging.dz) / SNAP) * SNAP;
    p.x = clamp(p.x, -room.w / 2 + fp.w / 2, room.w / 2 - fp.w / 2);
    p.z = clamp(p.z, -room.d / 2 + fp.d / 2, room.d / 2 - fp.d / 2);
    place(p);
  }

  function onUp() {
    if (!dragging) return;
    dragging = null;
    stage.controls.enabled = true;
    save();
    render();
  }

  function turnSelected() {
    if (!selected) return;
    selected.rot = (selected.rot + 90) % 360;
    place(selected);
    render();
  }

  function onKey(e) {
    if (e.key === 'r' || e.key === 'R') turnSelected();
  }

  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('keydown', onKey);

  stage.frame(new THREE.Box3(
    new THREE.Vector3(-room.w / 2 * MM, 0, -room.d / 2 * MM),
    new THREE.Vector3(room.w / 2 * MM, room.ceiling * MM, room.d / 2 * MM),
  ), { azimuth: 0.7, elevation: 0.85, pad: 1.1 });
  render();

  return {
    unmount() {
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
      panel.remove();
      stage.world.remove(world);
      stage.grid.visible = true;
      stage.floor.visible = true;
      stage.setBackground(0x11141a);
      stage.controls.enabled = true;
    },
  };
}
