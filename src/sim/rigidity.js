// Constraint / degrees-of-freedom analysis. This is the readout that makes the
// build legible as engineering rather than as a checklist: one dowel leaves a
// panel free to swing, two in a line still let it pivot, three non-collinear
// points lock it.

import { dist, sub, cross, len, normalize } from '../core/util.js';
import { FASTENERS } from '../content/hardware.js';

const FULL_DOF = 6;

export function analyze(asm) {
  const { state, kit } = asm;
  const placed = [...state.placed.keys()];
  const anchorSlot = kit.slots.find((s) => s.anchor && state.placed.has(s.id))?.id ?? placed[0] ?? null;

  // 1. Connectivity: what is tied back to the anchor through load-bearing joints.
  const connected = new Set(anchorSlot ? [anchorSlot] : []);
  for (let grew = true; grew;) {
    grew = false;
    for (const j of asm.joints.values()) {
      if (!asm.jointEffective(j) || asm.jointQuality(j) <= 0) continue;
      const ends = [j.a, j.b].filter(Boolean);
      if (ends.some((e) => connected.has(e)) && ends.some((e) => !connected.has(e))) {
        ends.forEach((e) => connected.add(e));
        grew = true;
      }
    }
  }

  // 2. Constraint budget per part, counting every load-bearing joint to any
  //    placed neighbour — a closed frame braces itself, so this is not a
  //    strict outward growth from the anchor.
  const parts = placed.map((slotId) => {
    const link = linkage(asm, slotId);
    const isAnchor = slotId === anchorSlot;
    // Some parts are meant to move — a shelf that lifts out, a door that swings,
    // a leg that threads in. They are reported as intentionally free, not as faults.
    const freeBy = asm.slots.get(slotId).freeBy;
    const byDesign = !!freeBy && link.constraints > 0;
    const rigid = isAnchor || byDesign
      || (connected.has(slotId) && link.constraints >= 5.5 && !link.collinear);
    return {
      slotId,
      name: asm.partName(asm.slots.get(slotId).part),
      constraints: Math.min(FULL_DOF, +link.constraints.toFixed(1)),
      dof: isAnchor ? 0 : dofFrom(link),
      rigid, byDesign, freeBy, connected: isAnchor || connected.has(slotId), collinear: link.collinear,
      joints: link.joints,
      placedWrong: !state.placed.get(slotId).correct,
    };
  });

  const all = [...asm.joints.values()];
  const effective = all.filter((j) => asm.jointEffective(j));
  const maxC = all.reduce((a, j) => a + FASTENERS[j.type].constraints, 0) || 1;
  const gotC = effective.reduce((a, j) => a + FASTENERS[j.type].constraints * asm.jointQuality(j), 0);
  const effC = effective.reduce((a, j) => a + FASTENERS[j.type].constraints, 0);

  const stiffness = clamp01((gotC / maxC) * state.squareness);
  return {
    anchorSlot, parts, connected,
    // floating = nothing fastening it back to the base at all.
    // underConstrained = attached, but with fewer constraints than it needs.
    floating: parts.filter((p) => !p.connected).map((p) => p.slotId),
    underConstrained: parts.filter((p) => p.connected && !p.rigid && !p.byDesign).map((p) => p.slotId),
    stiffness,
    jointsDone: effective.length,
    jointsTotal: all.length,
    avgQuality: effC ? gotC / effC : 0,
    squareness: state.squareness,
    /** How much a part should visibly shake in the wobble test. */
    wobbleOf(slotId) {
      const p = parts.find((x) => x.slotId === slotId);
      if (!p) return 0;
      const base = p.rigid ? p.dof / FULL_DOF * 0.5 : 0.5 + p.dof / FULL_DOF;
      return clamp01(base * (1.15 - state.squareness * 0.5));
    },
  };
}

/** Every load-bearing joint holding `slotId` to a placed neighbour. */
function linkage(asm, slotId) {
  const pts = [];
  const joints = [];
  let constraints = 0;
  for (const j of asm.jointsOfSlot(slotId)) {
    const other = j.a === slotId ? j.b : j.a;
    if (!asm.jointEffective(j)) continue;
    if (other && !asm.isPlaced(other)) continue;
    const q = asm.jointQuality(j);
    if (q <= 0) continue;
    constraints += FASTENERS[j.type].constraints * q;
    pts.push(j.pos);
    joints.push({ id: j.id, type: j.type, quality: q });
  }
  // A dowel or a pin is an axial peg: two of them in a line leave a pivot. A cam,
  // a screw or a hinge clamps face to face, so two of those already resist the
  // moment. That distinction is the whole reason a kit gives you both.
  const clamps = joints.some((j) => !['dowel', 'pin'].includes(j.type));
  const distinct = distinctPoints(pts);
  const collinear = isCollinear(pts) && !(clamps && distinct >= 2);
  return { constraints, points: pts, joints, collinear, distinct, clamps };
}

function distinctPoints(pts) {
  const uniq = [];
  for (const p of pts) if (!uniq.some((q) => dist(p, q) < 15)) uniq.push(p);
  return uniq.length;
}

/** Fewer than two distinct points, or all points on one line, leaves a rotation free. */
function isCollinear(pts) {
  const uniq = [];
  for (const p of pts) if (!uniq.some((q) => dist(p, q) < 15)) uniq.push(p);
  if (uniq.length < 2) return true;
  if (uniq.length === 2) return true;
  const axis = normalize(sub(uniq[1], uniq[0]));
  return uniq.slice(2).every((p) => len(cross(sub(p, uniq[0]), axis)) < 15);
}

function dofFrom(link) {
  if (!link.joints.length) return FULL_DOF;
  // A single clamping fastener still bears on the face around it, so the part can
  // only spin about the fastener axis. A single peg lets it swing as well.
  if (link.distinct === 1) return link.clamps ? 1 : 3;
  const free = Math.max(0, FULL_DOF - link.constraints);
  // Collinear constraint points always leave the twist about that line.
  return Math.round((link.collinear ? Math.max(1, free) : free) * 10) / 10;
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
