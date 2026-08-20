// The report card. Every term is shown to the player — no hidden weighting.

import { clamp, round, sum } from '../core/util.js';
import { FASTENERS } from '../content/hardware.js';

export function scoreBuild(asm, rig) {
  const { state, kit } = asm;
  const elapsed = (state.finishedAt ?? Date.now()) - state.startedAt;
  const par = kit.parTimeMs ?? kit.steps.length * 45_000;

  // Torque precision: how close each driven fastener sat to the middle of spec.
  const samples = state.stats.torque.filter((t) => t.band);
  const precision = samples.length
    ? sum(samples, (t) => {
      const mid = (t.band[0] + t.band[1]) / 2;
      const half = Math.max(0.01, (t.band[1] - t.band[0]) / 2);
      return clamp(1 - Math.abs(t.power - mid) / (half * 2), 0, 1);
    }) / samples.length
    : 0;

  const damage = state.stats.damage.length;
  const misplacements = state.stats.misplacements;
  const wrongTools = state.stats.toolErrors;
  const speed = clamp(par / Math.max(par * 0.35, elapsed), 0, 1.25);
  const leftover = kit.joints.length - rig.jointsDone;

  const terms = [
    { key: 'stiffness',  label: 'Structural stiffness', weight: 34, value: rig.stiffness },
    { key: 'precision',  label: 'Torque precision',     weight: 22, value: precision },
    { key: 'square',     label: 'Squareness',           weight: 14, value: rig.squareness },
    { key: 'accuracy',   label: 'First-time-right',     weight: 16, value: clamp(1 - misplacements * 0.18 - wrongTools * 0.12, 0, 1) },
    { key: 'damage',     label: 'Undamaged hardware',   weight: 8,  value: clamp(1 - damage * 0.25, 0, 1) },
    { key: 'speed',      label: 'Pace vs. par',         weight: 6,  value: clamp(speed, 0, 1) },
  ];
  const score = Math.round(sum(terms, (t) => t.weight * t.value));
  const grade = score >= 95 ? 'S' : score >= 86 ? 'A' : score >= 74 ? 'B' : score >= 60 ? 'C' : score >= 45 ? 'D' : 'E';

  return {
    kitId: kit.id, score, grade, terms, elapsed, par,
    precision: round(precision, 3),
    stiffness: round(rig.stiffness, 3),
    squareness: round(rig.squareness, 3),
    damage, misplacements, wrongTools, leftover,
    floating: rig.floating.length,
    underConstrained: rig.underConstrained.length,
    notes: notes({ rig, damage, misplacements, wrongTools, leftover, precision, state }),
    faults: state.stats.damage.map((d) => ({
      joint: d.jointId,
      fastener: FASTENERS[asm.joints.get(d.jointId).type].name,
      fault: d.fault,
    })),
  };
}

function notes({ rig, damage, misplacements, wrongTools, leftover, precision, state }) {
  const out = [];
  if (rig.squareness < 0.95) out.push('The carcass was racked when the back went on. That error is permanent — the diagonals will never match now.');
  if (rig.floating.length) out.push(`${rig.floating.length} part(s) are not tied back to the base at all. They are held by gravity and friction.`);
  if (rig.underConstrained.length) out.push(`${rig.underConstrained.length} part(s) are attached but under-constrained — not enough fasteners are pulling up tight to lock them.`);
  if (damage) out.push(`${damage} damaged fastener(s). Each one costs roughly two thirds of that joint's stiffness for the life of the piece.`);
  if (wrongTools) out.push('Wrong driver used — a cammed-out recess never pulls up tight, no matter how hard you lean on it.');
  if (misplacements) out.push(`${misplacements} panel(s) went in facing the wrong way. Reading the hole pattern before you commit is free; taking it apart is not.`);
  if (leftover > 0) out.push(`${leftover} fastener(s) were never driven.`);
  if (precision > 0.9 && !damage) out.push('Torque discipline was excellent: every fastener landed inside its band.');
  if (!out.length) out.push('Textbook. Square, tight, nothing left in the bag.');
  return out;
}

export function gradeColour(grade) {
  return { S: '#7ee787', A: '#9ae6b4', B: '#f0d264', C: '#f0a85b', D: '#ef8a6a', E: '#e05c5c' }[grade] ?? '#ccc';
}
