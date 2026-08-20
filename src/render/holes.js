// Where a derived hole actually breaks the surface of its part, and which way
// the tool comes at it. Shared by the panel meshes, the hardware meshes and the
// click targets, so all three always agree.

import { AXES, applyM, clamp, eulerMatrix, toWorld } from '../core/util.js';
import { FASTENERS } from '../content/hardware.js';

/**
 * Project a hole onto the face of its part.
 * Returns the local point on the surface, the outward normal, and the depth axis.
 */
export function faceProject(part, hole) {
  const f = FASTENERS[hole.type];
  const ai = dominantAxis(hole.axis);
  const half = part.size[ai] / 2;
  const near = hole.local[ai] >= 0 ? half : -half;
  // Cams, screws, nails: you drive them from the outside face, so the visible end
  // is on the far side of the board. Dowels, pins and hanger bolts show at the
  // face they enter.
  const at = (hole.side === 'a' && f.driveFromFarFace) ? -near : near;

  const local = hole.local.slice();
  local[ai] = at;
  // keep the disc inside the panel outline
  const r = (f[hole.side === 'a' ? 'holeA' : 'holeB']?.dia ?? 6) / 2;
  for (const k of [0, 1, 2]) {
    if (k === ai) continue;
    const lim = Math.max(0, part.size[k] / 2 - r - 1);
    local[k] = clamp(local[k], -lim, lim);
  }
  const normal = [0, 0, 0];
  normal[ai] = Math.sign(at) || 1;
  return { local, normal, axisIndex: ai, dia: r * 2 };
}

export const dominantAxis = (v) => {
  const a = v.map(Math.abs);
  return a[0] >= a[1] && a[0] >= a[2] ? 0 : a[1] >= a[2] ? 1 : 2;
};

/**
 * Where the player has to point the tool for one phase of a joint, in assembly
 * (millimetre) space. Uses the part's current placement if it has one.
 */
export function driveSite(asm, joint, phase) {
  const spec = joint[phase];
  const slotId = spec ? joint[spec.in] : joint.a;
  const slot = asm.slots.get(slotId);
  const part = asm.kit.parts.find((p) => p.id === slot.part);
  const hole = asm.holesFor(slotId).find((h) => h.jointId === joint.id);
  if (!hole) return { pos: joint.pos, normal: AXES[joint.axis], slotId };
  const { local, normal } = faceProject(part, hole);
  const { pos, rot } = asm.transformOf(slotId);
  const rotM = eulerMatrix(rot);
  return { pos: toWorld(local, pos, rotM), normal: applyM(rotM, normal), slotId, hole };
}
