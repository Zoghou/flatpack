// The instruction booklet: wordless line art, rendered from the same geometry
// the game plays with, so the manual can never disagree with the model.

import * as THREE from 'three';
import { MM, DEG, AXES, scale as vscale } from '../core/util.js';
import { buildOutline } from './partmesh.js';
import { driveSite } from './holes.js';

export function createBooklet(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf7f5f0);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -50, 50);
  const root = new THREE.Group();
  scene.add(root);

  const PALE = new THREE.LineBasicMaterial({ color: 0xb9b4a9 });
  const INK = new THREE.LineBasicMaterial({ color: 0x1b1b1b });
  const HI = new THREE.LineBasicMaterial({ color: 0x1173d4 });

  function clear() {
    for (const c of [...root.children]) {
      root.remove(c);
      c.traverse?.((o) => o.geometry?.dispose?.());
    }
  }

  /** Draw one step: what is already built in pale outline, what goes on next in ink. */
  function draw(asm, step) {
    clear();
    if (!step) { render(); return; }
    const kit = asm.kit;
    const focusSlots = new Set(step.slots ?? []);
    const focusJoints = (step.joints ?? []).map((id) => asm.joints.get(id));
    for (const j of focusJoints) { focusSlots.add(j.a); if (j.b) focusSlots.add(j.b); }

    for (const slot of kit.slots) {
      const shown = asm.isPlaced(slot.id) || focusSlots.has(slot.id);
      if (!shown) continue;
      const part = kit.parts.find((p) => p.id === slot.part);
      const isFocus = focusSlots.has(slot.id) && !asm.isPlaced(slot.id);
      const line = buildOutline(part, 0xffffff);
      line.material = isFocus ? INK : PALE;
      const { pos, rot } = asm.transformOf(slot.id);
      // Parts that are not in yet are drawn exploded along the way they go in.
      const off = isFocus ? explodeOffset(asm, slot.id, step) : [0, 0, 0];
      line.position.set((pos[0] + off[0]) * MM, (pos[1] + off[1]) * MM, (pos[2] + off[2]) * MM);
      line.rotation.set(rot[0] * DEG, rot[1] * DEG, rot[2] * DEG, 'XYZ');
      root.add(line);
      if (isFocus && (off[0] || off[1] || off[2])) root.add(dashedPath(pos, off));
    }

    for (const j of focusJoints) {
      const phase = step.op === 'insert' ? 'pre' : 'lock';
      const site = driveSite(asm, j, j[phase] ? phase : (j.pre ? 'pre' : 'lock'));
      root.add(circle(site.pos, 16, HI));
      root.add(arrow(site.pos, site.normal, 70));
    }

    fit();
    render();
  }

  function explodeOffset(asm, slotId, step) {
    const j = (step.joints ?? []).map((id) => asm.joints.get(id)).find((x) => x.a === slotId || x.b === slotId)
      ?? asm.jointsOfSlot(slotId).find((x) => asm.isPlaced(x.a === slotId ? x.b : x.a));
    if (!j) return [0, 240, 0];
    const slot = asm.slots.get(slotId);
    const dir = AXES[j.axis];
    const sign = Math.sign(slot.pos[axisIndex(j.axis)] - j.pos[axisIndex(j.axis)]) || 1;
    return vscale(dir, 210 * sign);
  }

  const axisIndex = (a) => ({ x: 0, y: 1, z: 2 }[a]);

  function dashedPath(pos, off) {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(pos[0] * MM, pos[1] * MM, pos[2] * MM),
      new THREE.Vector3((pos[0] + off[0]) * MM, (pos[1] + off[1]) * MM, (pos[2] + off[2]) * MM),
    ]);
    const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0x1173d4, dashSize: 0.02, gapSize: 0.015 }));
    l.computeLineDistances();
    return l;
  }

  function circle(posMm, r, mat) {
    const pts = [];
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r * MM, Math.sin(a) * r * MM, 0));
    }
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
    l.position.set(posMm[0] * MM, posMm[1] * MM, posMm[2] * MM);
    l.quaternion.copy(camera.quaternion);
    return l;
  }

  function arrow(posMm, normal, len) {
    const dir = new THREE.Vector3(...normal).normalize();
    const a = new THREE.ArrowHelper(dir, new THREE.Vector3(posMm[0] * MM, posMm[1] * MM, posMm[2] * MM).addScaledVector(dir, len * MM),
      len * MM, 0x1173d4, 22 * MM, 13 * MM);
    a.setDirection(dir.clone().negate());
    return a;
  }

  /** Isometric three-quarter view, scaled to whatever is on the page. */
  function fit() {
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getSize(new THREE.Vector3());
    const w = canvas.clientWidth || 320, h = canvas.clientHeight || 260;
    const aspect = w / h;
    const extent = Math.max(s.x, s.y, s.z) * 0.82 + 0.15;
    camera.left = -extent * aspect; camera.right = extent * aspect;
    camera.top = extent; camera.bottom = -extent;
    camera.updateProjectionMatrix();
    camera.position.copy(c).add(new THREE.Vector3(1, 0.82, 1.15).multiplyScalar(6));
    camera.lookAt(c);
  }

  function render() {
    const w = canvas.clientWidth || 320, h = canvas.clientHeight || 260;
    renderer.setSize(w, h, false);
    renderer.render(scene, camera);
  }

  return { draw, render, dispose: () => { clear(); renderer.dispose(); } };
}
