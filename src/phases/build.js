// The build phase: the game proper. Owns the 3D assembly view, the input model
// and the per-step interaction, and hands the finished result back to the store.

import * as THREE from 'three';
import { MM, clamp } from '../core/util.js';
import { TOOLS } from '../content/hardware.js';
import { createAssembly } from '../sim/assembly.js';
import { analyze } from '../sim/rigidity.js';
import { scoreBuild } from '../sim/scoring.js';
import { buildPart, buildOutline, placeAt } from '../render/partmesh.js';
import { buildFastener, buildMarker } from '../render/hardwaremesh.js';
import { driveSite } from '../render/holes.js';
import { createBooklet } from '../render/booklet.js';
import { createHud } from '../ui/hud.js';
import { h } from '../ui/dom.js';
import { state as gameState, save, recordBuild } from '../core/store.js';

const RAMP = 1.3;                       // how fast the gauge climbs, per second

export function mountBuild({ stage, root, kit, onExit, onFinished }) {
  const asm = createAssembly(kit, { seed: gameState.settings.seed, assist: gameState.settings.assist });
  if (gameState.buildSnapshot?.kitId === kit.id) asm.restore(gameState.buildSnapshot);

  const world = new THREE.Group();
  stage.world.add(world);
  const gParts = new THREE.Group(), gHardware = new THREE.Group(), gMarkers = new THREE.Group();
  world.add(gParts, gHardware, gMarkers);

  const hud = createHud(root, {
    kit,
    onTool: selectTool,
    onPartPick: pickPart,
    onStepSelect: (id) => { focusStepId = id; refresh(); },
    onExplode: () => { exploded = !exploded; hud.setExplode(exploded); rebuild(); },
    onAssist: () => { gameState.settings.assist = !gameState.settings.assist; save(); hud.setAssist(gameState.settings.assist); refresh(); },
    onExit,
  });
  const booklet = createBooklet(hud.bookletCanvas);

  let tool = 'hand';
  let held = null;                       // part id in hand
  let candidates = [];                   // slot ids the held part could go into
  let candIndex = 0, orientIndex = 0;
  let focusStepId = null;
  let exploded = false;
  let driving = null;                    // { jointId, phase, power, spec }
  let selected = null;                   // slot id tapped on, offered for removal
  let wobble = null;
  let stopAnim = null;

  // ------------------------------------------------------------- 3D build ---

  const centroidOf = () => {
    const b = new THREE.Box3();
    kit.slots.forEach((s) => b.expandByPoint(new THREE.Vector3(...s.pos).multiplyScalar(MM)));
    return b.getCenter(new THREE.Vector3());
  };
  const centre = centroidOf();

  function explodeOffset(pos) {
    if (!exploded) return new THREE.Vector3();
    const v = new THREE.Vector3(...pos).multiplyScalar(MM).sub(centre);
    return v.clone().normalize().multiplyScalar(v.length() * 0.35 + 0.07);
  }

  function rebuild() {
    for (const g of [gParts, gHardware, gMarkers]) {
      for (const c of [...g.children]) { g.remove(c); c.traverse?.((o) => o.geometry?.dispose?.()); }
    }
    const step = currentStep();

    // parts already in
    for (const slot of kit.slots) {
      if (!asm.isPlaced(slot.id)) continue;
      const placed = asm.state.placed.get(slot.id);
      const part = kit.parts.find((p) => p.id === slot.part);
      const g = buildPart(part, asm.holesFor(slot.id), { wrong: !placed.correct });
      const { pos, rot } = asm.transformOf(slot.id);
      placeAt(g, pos, rot);
      g.position.add(explodeOffset(slot.pos));
      if (wobble) g.position.add(wobbleOffset(slot.id));
      g.userData.pick = { kind: 'part', id: slot.id };
      gParts.add(g);
    }

    // a part that is being worked on before it goes in is shown where it will end
    // up, so the fastener sites make sense
    const preSlots = new Set();
    if (step && step.op === 'insert') {
      for (const jid of step.joints ?? []) {
        const j = asm.joints.get(jid);
        const target = j[step.op === 'insert' ? 'pre' : 'lock']?.in ?? 'a';
        if (!asm.isPlaced(j[target])) preSlots.add(j[target]);
      }
    }
    for (const slotId of preSlots) {
      const slot = asm.slots.get(slotId);
      const part = kit.parts.find((p) => p.id === slot.part);
      const g = buildPart(part, asm.holesFor(slotId), { ghost: true, opacity: 0.22 });
      const { pos, rot } = asm.transformOf(slotId);
      placeAt(g, pos, rot);
      g.position.add(explodeOffset(slot.pos));
      gParts.add(g);
    }

    // driven fasteners
    for (const j of asm.joints.values()) {
      const st = asm.state.jointState.get(j.id);
      for (const phase of ['pre', 'lock']) {
        if (!st[phase]) continue;
        const site = driveSite(asm, j, phase);
        const f = buildFastener(j, phase, st[phase].quality, site);
        f.position.add(explodeOffset(j.pos));
        gHardware.add(f);
      }
    }

    // what to click next
    if (held) {
      const slotId = candidates[candIndex];
      if (slotId) {
        const slot = asm.slots.get(slotId);
        const part = kit.parts.find((p) => p.id === slot.part);
        const opt = asm.orientationOptions(slotId)[orientIndex];
        const correct = asm.misalignment(slotId, opt.rot) <= 1;
        const colour = gameState.settings.assist ? (correct ? 0x7ee787 : 0xef8a6a) : 0x63d7ff;
        const g = buildPart(part, asm.holesFor(slotId), { ghost: true, colour, opacity: 0.42 });
        placeAt(g, slot.pos, opt.rot);
        g.position.add(explodeOffset(slot.pos));
        g.userData.pick = { kind: 'ghost', id: slotId };
        const outline = buildOutline(part, colour);
        g.add(outline);
        gMarkers.add(g);
      }
      for (const [i, cid] of candidates.entries()) {
        if (i === candIndex) continue;
        const s = asm.slots.get(cid);
        const m = buildMarker({ pos: s.pos, normal: [0, 1, 0] }, { colour: 0x51607a, radius: 26, id: cid, kind: 'candidate' });
        gMarkers.add(m);
      }
    } else if (step && (step.op === 'insert' || step.op === 'fasten')) {
      const phase = step.op === 'insert' ? 'pre' : 'lock';
      for (const jid of step.joints ?? []) {
        const j = asm.joints.get(jid);
        const st = asm.state.jointState.get(jid);
        if (st[phase]) continue;
        const site = driveSite(asm, j, phase);
        const m = buildMarker(site, { colour: driving?.jointId === jid ? 0xffffff : 0x63d7ff, id: jid, kind: 'joint', phase });
        m.position.add(explodeOffset(j.pos));
        gMarkers.add(m);
      }
    } else if (step && step.op === 'place') {
      for (const slotId of step.slots ?? []) {
        if (asm.isPlaced(slotId)) continue;
        const slot = asm.slots.get(slotId);
        const part = kit.parts.find((p) => p.id === slot.part);
        const o = buildOutline(part, 0x3f5f7a);
        placeAt(o, slot.pos, slot.rot);
        o.position.add(explodeOffset(slot.pos));
        gMarkers.add(o);
      }
    }
    stage.requestRender();
  }

  const wobblePhase = new Map();
  function wobbleOffset(slotId) {
    if (!wobble) return new THREE.Vector3();
    const amp = wobble.rig.wobbleOf(slotId);
    if (!wobblePhase.has(slotId)) wobblePhase.set(slotId, Math.random() * Math.PI * 2);
    const t = wobble.t;
    const decay = Math.max(0, 1 - t / wobble.duration);
    const a = amp * decay * 0.022 * Math.sin(t * 11 + wobblePhase.get(slotId));
    return new THREE.Vector3(a, a * 0.15, a * 0.4);
  }

  // ----------------------------------------------------------- step layer ---

  function currentStep() {
    const open = asm.openSteps();
    if (!open.length) return null;
    return open.find((s) => s.id === focusStepId) ?? open[0];
  }

  /** Keep the on-screen action bar in step with what is in hand. */
  function updateActions() {
    if (held) {
      const slotId = candidates[candIndex];
      const opts = asm.orientationOptions(slotId);
      // Slot ids are written to be readable ('side-l', 'shelf'), so they are
      // the label; the counter only appears when there is a choice to make.
      const where = candidates.length > 1
        ? `${slotId} — position ${candIndex + 1} of ${candidates.length}`
        : slotId;
      const list = [];
      if (opts.length > 1) list.push({ label: 'Turn it', hint: 'R', onClick: turnHeld });
      if (candidates.length > 1) list.push({ label: 'Next position', hint: 'Tab', onClick: nextSlot });
      list.push({ label: 'Fit it here', hint: '⏎', kind: 'primary', onClick: commitPlace });
      list.push({ label: 'Put it back', hint: 'Esc', onClick: dropHeld });
      hud.setActions(`<b>${asm.partName(held)}</b> — ${where}`, list);
    } else if (selected) {
      const p = kit.parts.find((x) => x.id === asm.slots.get(selected).part);
      hud.setActions(`<b>${p.name}</b> ${p.id}`, [
        { label: 'Take it out', onClick: () => { hud.toast(asm.unplace(selected)); selected = null; refresh(); } },
        { label: 'Leave it', onClick: () => { selected = null; updateActions(); } },
      ]);
    } else {
      hud.setActions(null, null);
    }
  }

  function turnHeld() {
    if (!held) return;
    orientIndex = (orientIndex + 1) % asm.orientationOptions(candidates[candIndex]).length;
    rebuild();
    updateActions();
  }

  function nextSlot() {
    if (!held) return;
    candIndex = (candIndex + 1) % candidates.length;
    orientIndex = 0;
    rebuild();
    updateActions();
  }

  function dropHeld() {
    held = null;
    candidates = [];
    hud.setHint('');
    refresh();
  }

  function refresh() {
    const step = currentStep();
    focusStepId = step?.id ?? null;
    const rig = analyze(asm);
    hud.setSteps(asm);
    hud.setBom(asm, held);
    hud.setReadout(rig, asm);
    hud.setStep(step, asm, stepExtras(step, rig));
    hud.setTool(tool);
    booklet.draw(asm, step);
    updateActions();
    rebuild();
    gameState.buildSnapshot = asm.serialize();
    save();
  }

  function stepExtras(step, rig) {
    if (!step) return {};
    switch (step.op) {
      case 'bom':
        return { detail: 'Click every line in the parts list on the right to check it off.', actions: [] };
      case 'place':
        return {
          detail: held
            ? `Holding ${asm.partName(held)}. R turns it, Tab moves to the next position, click the ghost to fit it.`
            : 'Pick the part up from the list on the right.',
          actions: [],
        };
      case 'insert':
      case 'fasten':
        return {
          detail: `Select the ${TOOLS[step.tool]?.name ?? 'right tool'}, then hold the mouse on a highlighted fastener and let go inside the band.`,
          actions: [],
        };
      case 'check':
        return {
          detail: 'Take the try square and measure both diagonals.',
          actions: [{
            label: 'Measure the diagonals',
            onClick: () => {
              if (tool !== 'square') { hud.toast({ kind: 'warn', text: 'Pick up the try square first (key 5).' }); return; }
              const ev = asm.checkSquare();
              hud.toast(ev);
              if (ev.joints?.length) highlightJoints(ev.joints);
              refresh();
            },
          }],
        };
      case 'adjust':
        return { detail: 'Turn the depth screw until the gap is even.', actions: [{ label: 'Open the adjuster', onClick: openAdjuster }] };
      case 'finish':
        return {
          detail: 'Push it and see what moves.',
          actions: [{ label: 'Run the test', kind: 'primary', onClick: runWobble }],
        };
      default:
        return {};
    }
  }

  function highlightJoints(ids) {
    for (const id of ids) {
      const j = asm.joints.get(id);
      const site = driveSite(asm, j, j.lock ? 'lock' : 'pre');
      const m = buildMarker(site, { colour: 0xef8a6a, id, kind: 'joint', phase: j.lock ? 'lock' : 'pre' });
      gMarkers.add(m);
    }
    stage.requestRender();
  }

  function openAdjuster() {
    const step = currentStep();
    hud.showOverlay((card, close) => {
      card.classList.add('adjuster');
      card.innerHTML = `<h2>Hinge depth adjustment</h2>
        <p class="muted">Concealed hinges adjust on three axes. Turn the depth screw until the gap down the hinge side is even, top to bottom.</p>`;
      const gapWrap = h('div', 'gap-view');
      const bar = h('div', 'gap-bar');
      const doorEl = h('div', 'gap-door');
      gapWrap.append(bar, doorEl);
      const slider = h('input');
      slider.type = 'range'; slider.min = '0'; slider.max = '1'; slider.step = '0.01';
      slider.value = String(asm.state.hingeGap ?? 0.15);
      const readoutEl = h('div', 'gap-readout');
      const update = () => {
        const v = Number(slider.value);
        doorEl.style.transform = `translateX(${v * 42}px) rotate(${(0.5 - v) * 2.2}deg)`;
        readoutEl.textContent = `gap ${(v * 6).toFixed(1)} mm — spec ${(step.band[0] * 6).toFixed(1)}–${(step.band[1] * 6).toFixed(1)} mm`;
        readoutEl.className = `gap-readout ${v >= step.band[0] && v <= step.band[1] ? 'in' : 'out'}`;
      };
      slider.oninput = update;
      const row = h('div', 'overlay-actions');
      const set = h('button', 'btn primary', 'Lock the screw');
      set.onclick = () => {
        hud.toast(asm.adjust(step.id, Number(slider.value)));
        close();
        refresh();
      };
      const cancel = h('button', 'btn ghost', 'Later');
      cancel.onclick = close;
      row.append(set, cancel);
      card.append(gapWrap, slider, readoutEl, row);
      update();
    });
  }

  // ------------------------------------------------------------- actions ---

  function selectTool(id) {
    tool = id;
    hud.setTool(id);
    hud.setHint(`<b>${TOOLS[id].name}</b> — ${TOOLS[id].hint}`);
  }

  function pickPart(partId) {
    const step = currentStep();
    if (step?.op === 'bom') { hud.toast(asm.tickBom(partId)); refresh(); return; }
    const open = asm.openSteps().filter((s) => s.op === 'place');
    candidates = open.flatMap((s) => s.slots).filter((id) => asm.slots.get(id).part === partId && !asm.isPlaced(id));
    if (!candidates.length) {
      held = null;
      hud.toast({ kind: 'warn', text: `Nothing in the open steps takes ${asm.partName(partId)} yet.` });
      refresh();
      return;
    }
    held = partId;
    candIndex = 0;
    orientIndex = 0;
    selected = null;
    hud.setHint('Tap the ghost to fit it, or use the buttons below.');
    hud.focusScene();
    refresh();
  }

  function commitPlace() {
    const slotId = candidates[candIndex];
    if (!slotId) return;
    const opt = asm.orientationOptions(slotId)[orientIndex];
    const ev = asm.place(slotId, opt.id, held);
    hud.toast(ev);
    dropHeld();
  }

  function beginDrive(jointId, phase) {
    const j = asm.joints.get(jointId);
    const spec = j[phase];
    if (!spec) return;
    driving = { jointId, phase, power: 0, spec };
    stage.controls.enabled = false;      // a thumb driving a cam must not also orbit
    hud.showGauge({
      label: `${spec.driver === 'mallet' ? 'Strike force' : 'Torque'} — ${TOOLS[spec.driver].name.toLowerCase()} expected`,
      band: spec.band, strip: spec.strip, unit: spec.driver === 'mallet' ? 'strike' : 'torque',
    });
    stopAnim?.();
    stopAnim = stage.addAnimator((dt) => {
      if (!driving) return;
      // eases off as it comes up tight, the way a cam does
      driving.power = clamp(driving.power + dt * RAMP * (1 - driving.power * 0.72), 0, 1);
      hud.setPower(driving.power);
    });
    rebuild();
  }

  function endDrive() {
    if (!driving) return;
    const { jointId, phase, power } = driving;
    driving = null;
    stage.controls.enabled = true;
    stopAnim?.(); stopAnim = null;
    hud.hideGauge();
    hud.toast(asm.drive(jointId, phase, power, tool));
    refresh();
  }

  function runWobble() {
    const rig = analyze(asm);
    wobble = { t: 0, duration: 3.2, rig };
    stopAnim?.();
    stopAnim = stage.addAnimator((dt) => {
      wobble.t += dt;
      rebuild();
      if (wobble.t >= wobble.duration) {
        stopAnim?.(); stopAnim = null;
        wobble = null;
        finish();
      }
    });
    hud.setHint('<b>Wobble test</b> — anything that moves is a joint that is not carrying load.');
  }

  function finish() {
    asm.finish();
    const rig = analyze(asm);
    const res = scoreBuild(asm, rig);
    recordBuild(kit.id, res);
    refresh();
    hud.setHint('');
    hud.showReport(res, rig, asm, [
      { label: 'Done', kind: 'primary', onClick: () => { hud.hideOverlay(); onFinished(res); } },
    ]);
  }

  // --------------------------------------------------------------- input ---

  const canvas = stage.renderer.domElement;

  // A press that turns into a drag is the player orbiting the camera, so
  // everything except driving a fastener waits for the release and checks that
  // the finger stayed put. Without this, every orbit gesture that happens to
  // start on a panel also places a part.
  const TAP_SLOP = 10;                   // px of travel still counted as a tap
  const TAP_TIME = 700;                  // ms held before it is a hold, not a tap
  let down = null;

  function onPointerDown(e) {
    if (e.button === 2) return;
    // Markers are drawn through the model (depthTest off), so they have to pick
    // through it as well — otherwise a cam on the far face is visible but dead.
    const hit = stage.pick(e, [gMarkers]) ?? stage.pick(e, [gParts]);
    const pick = hit?.object.userData.pick ?? {};
    // Driving is a hold: it has to start on the press, and it owns the pointer
    // until release so the camera does not follow the finger.
    if (pick.kind === 'joint') {
      e.preventDefault();
      canvas.setPointerCapture?.(e.pointerId);
      beginDrive(pick.id, pick.phase);
      down = null;
      return;
    }
    down = { x: e.clientX, y: e.clientY, t: performance.now(), pick };
  }

  function onPointerUp(e) {
    endDrive();
    const d = down;
    down = null;
    if (!d) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_SLOP) return;
    if (performance.now() - d.t > TAP_TIME) return;
    onTap(d.pick);
  }

  function onTap({ kind, id }) {
    if (kind === 'ghost') commitPlace();
    else if (kind === 'candidate') { candIndex = candidates.indexOf(id); orientIndex = 0; rebuild(); updateActions(); }
    else if (kind === 'part') {
      const slot = asm.slots.get(id);
      const p = kit.parts.find((x) => x.id === slot.part);
      const placed = asm.state.placed.get(id);
      selected = held ? null : id;
      hud.setHint(`<b>${p.name}</b> ${p.id} · ${p.size.map(Math.round).join(' × ')} mm${placed.correct ? '' : ' · <span class="bad">fitted the wrong way round</span>'}`);
      updateActions();
    } else if (!held) {
      selected = null;
      updateActions();
    }
  }

  function onContextMenu(e) {
    const hit = stage.pick(e, [gParts]);
    const pick = hit?.object.userData.pick;
    if (pick?.kind !== 'part') return;
    e.preventDefault();
    hud.toast(asm.unplace(pick.id));
    refresh();
  }

  function onKeyDown(e) {
    if (e.target.tagName === 'INPUT') return;
    const toolByKey = Object.values(TOOLS).find((t) => t.key === e.key);
    if (toolByKey) { selectTool(toolByKey.id); return; }
    switch (e.key) {
      case 'r': case 'R': turnHeld(); break;
      case 'Tab':
        if (!held) return;
        e.preventDefault();
        nextSlot();
        break;
      case 'Enter': if (held) commitPlace(); break;
      case 'Escape': selected = null; dropHeld(); break;
      case 'e': case 'E': exploded = !exploded; hud.setExplode(exploded); rebuild(); break;
      default: break;
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown', onKeyDown);

  const timerId = setInterval(() => {
    if (!asm.state.finishedAt) hud.setTimer(Date.now() - asm.state.startedAt);
  }, 500);

  // --------------------------------------------------------------- start ---

  selectTool('hand');
  hud.setAssist(gameState.settings.assist);
  // Testing seam: the browser test drives the same picking path a player does.
  window.__flatpack = { asm, stage, markers: gMarkers, hud, THREE };
  refresh();
  stage.frame(kitBox(kit), { azimuth: 0.9, elevation: 0.35 });

  return {
    unmount() {
      clearInterval(timerId);
      stopAnim?.();
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      booklet.dispose();
      hud.destroy();
      delete window.__flatpack;
      stage.world.remove(world);
    },
  };
}

function kitBox(kit) {
  const b = new THREE.Box3();
  for (const s of kit.slots) {
    const p = kit.parts.find((x) => x.id === s.part);
    const r = Math.max(...p.size) / 2 * MM;
    b.expandByPoint(new THREE.Vector3(...s.pos).multiplyScalar(MM).addScalar(r));
    b.expandByPoint(new THREE.Vector3(...s.pos).multiplyScalar(MM).addScalar(-r));
  }
  return b;
}
