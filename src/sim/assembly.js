// The assembly runtime: the rules of building a kit. Pure logic — no DOM, no
// Three.js — so it can be reasoned about (and tested) on its own.

import {
  AXES, applyMT, composeEuler, dist, eulerMatrix, mulberry32, shuffle, toLocal, toWorld,
} from '../core/util.js';
import { FASTENERS, FAULTS } from '../content/hardware.js';

const HOLE_TOL = 1.0;            // mm: how far a derived hole may sit from its joint
const FLIPS = {
  x180: [180, 0, 0], y180: [0, 180, 0], z180: [0, 0, 180],
  y90: [0, 90, 0], 'y-90': [0, -90, 0], x90: [90, 0, 0],
};

export function createAssembly(kit, { seed = 1, assist = true } = {}) {
  const slots = new Map(kit.slots.map((s) => [s.id, s]));
  const joints = new Map(kit.joints.map((j) => [j.id, j]));
  const steps = kit.steps;
  const stepById = new Map(steps.map((s) => [s.id, s]));

  // ---------------------------------------------------------- derived holes --
  // Every hole in the game is computed from a joint, never authored. This is
  // what guarantees the art, the validation and the booklet agree.
  const holesBySlot = new Map(kit.slots.map((s) => [s.id, []]));
  for (const j of joints.values()) {
    const f = FASTENERS[j.type];
    for (const side of ['a', 'b']) {
      const slotId = j[side];
      if (!slotId || !slots.has(slotId)) continue;
      const slot = slots.get(slotId);
      const rotM = eulerMatrix(slot.rot);
      const spec = side === 'a' ? f.holeA : f.holeB;
      if (!spec) continue;
      holesBySlot.get(slotId).push({
        jointId: j.id, side, type: j.type,
        local: toLocal(j.pos, slot.pos, rotM),
        axis: applyMT(rotM, AXES[j.axis]),             // joint axis in part-local frame
        dia: spec.dia, depth: spec.depth,
      });
    }
  }

  const state = {
    placed: new Map(),        // slotId -> { orientationId, rot, correct, misaligned }
    jointState: new Map(),    // jointId -> { pre, lock, mated }
    checked: new Set(),       // part ids ticked off in the BOM step
    completed: new Set(),
    squareness: 1,
    squareChecked: false,
    hingeGap: null,
    startedAt: Date.now(),
    finishedAt: null,
    log: [],
    stats: { placements: 0, misplacements: 0, wrongPart: 0, toolErrors: 0, redos: 0, damage: [], torque: [] },
  };
  for (const j of joints.keys()) state.jointState.set(j, { pre: null, lock: null, mated: false });

  const rnd = mulberry32(seed);
  const orientationCache = new Map();

  // ------------------------------------------------------------- queries ----

  const openSteps = () => steps.filter(
    (s) => !state.completed.has(s.id) && s.requires.every((r) => state.completed.has(r)),
  );

  const stepStatus = (s) => (state.completed.has(s.id) ? 'done'
    : s.requires.every((r) => state.completed.has(r)) ? 'open' : 'locked');

  /** The placement options a player cycles through: the truth plus its decoys. */
  function orientationOptions(slotId) {
    if (orientationCache.has(slotId)) return orientationCache.get(slotId);
    const slot = slots.get(slotId);
    const opts = [{ id: 'a', rot: slot.rot, correct: true }];
    (slot.flips ?? []).forEach((code, i) => {
      opts.push({ id: String.fromCharCode(98 + i), rot: composeEuler(slot.rot, FLIPS[code]), correct: false, code });
    });
    const out = shuffle(opts, rnd).map((o, i) => ({ ...o, index: i }));
    orientationCache.set(slotId, out);
    return out;
  }

  /** How far this orientation puts the part's holes from where the joints are. */
  function misalignment(slotId, rot) {
    const slot = slots.get(slotId);
    const rotM = eulerMatrix(rot);
    let worst = 0;
    for (const h of holesBySlot.get(slotId)) {
      const world = toWorld(h.local, slot.pos, rotM);
      worst = Math.max(worst, dist(world, joints.get(h.jointId).pos));
    }
    return worst;
  }

  const jointsOfSlot = (slotId) => [...joints.values()].filter((j) => j.a === slotId || j.b === slotId);
  const isPlaced = (slotId) => state.placed.has(slotId);

  /** A joint carries load once both its parts are there and every phase it needs is driven. */
  function jointEffective(j) {
    const st = state.jointState.get(j.id);
    if (!isPlaced(j.a) || (j.b && !isPlaced(j.b))) return false;
    if (j.pre && !st.pre) return false;
    if (j.lock && !st.lock) return false;
    return true;
  }

  function jointQuality(j) {
    const st = state.jointState.get(j.id);
    const q = [st.pre?.quality, st.lock?.quality].filter((x) => x != null);
    if (!q.length) return 0;
    return Math.min(...q);
  }

  // ------------------------------------------------------------- actions ----

  function log(kind, text, extra = {}) {
    const e = { kind, text, at: Date.now(), ...extra };
    state.log.push(e);
    return e;
  }

  /** Place `partId` into `slotId` with one of its orientation options. */
  function place(slotId, orientationId, partId) {
    const slot = slots.get(slotId);
    if (!slot) return log('bad', `No such slot ${slotId}.`);
    if (isPlaced(slotId)) return log('warn', 'Something is already in that position.');
    const step = openSteps().find((s) => s.op === 'place' && s.slots?.includes(slotId));
    if (!step) return log('warn', 'That part cannot go in yet — an earlier step is holding it up.', { code: 'order' });
    if (partId && partId !== slot.part) {
      state.stats.wrongPart++;
      return log('bad', `That is part ${partId}. This position takes ${slot.part}.`, { code: 'wrongpart' });
    }
    const opt = orientationOptions(slotId).find((o) => o.id === orientationId) ?? orientationOptions(slotId)[0];
    const off = misalignment(slotId, opt.rot);
    const correct = off <= HOLE_TOL;
    state.placed.set(slotId, { orientationId: opt.id, rot: opt.rot, correct, misaligned: off });
    state.stats.placements++;

    // A dowel already tapped into the mating part now bridges the two.
    for (const j of jointsOfSlot(slotId)) {
      if (jointEffective(j)) state.jointState.get(j.id).mated = true;
    }
    settle();
    if (!correct) {
      state.stats.misplacements++;
      return log('bad', `${partName(slot.part)} is in, but its holes miss by ${off.toFixed(0)} mm — it is facing the wrong way.`,
        { code: 'orientation', slotId, off });
    }
    return log('ok', `${partName(slot.part)} seated. Holes line up.`, { slotId });
  }

  function unplace(slotId) {
    const p = state.placed.get(slotId);
    if (!p) return log('warn', 'Nothing to take out there.');
    const driven = jointsOfSlot(slotId).some((j) => {
      const st = state.jointState.get(j.id);
      return ['pre', 'lock'].some((ph) => st[ph] && j[ph] && j[j[ph].in] === slotId);
    });
    if (driven) return log('warn', 'It is fastened in place. Undo the fasteners first.', { code: 'fastened' });
    state.placed.delete(slotId);
    state.stats.redos++;
    return log('ok', `${partName(slots.get(slotId).part)} removed.`, { slotId });
  }

  /**
   * Drive one phase of a fastener.
   *   power — 0..1 from the gauge (torque for drivers, strike force for the mallet)
   *   tool  — the tool the player had selected
   */
  function drive(jointId, phase, power, tool) {
    const j = joints.get(jointId);
    if (!j) return log('bad', `No such fastener ${jointId}.`);
    const spec = j[phase];
    if (!spec) return log('warn', 'Nothing to do on that fastener at this stage.');
    const st = state.jointState.get(jointId);

    const wantedOp = phase === 'pre' ? 'insert' : 'fasten';
    const step = openSteps().find((s) => s.op === wantedOp && s.joints?.includes(jointId));
    if (!step) {
      if (st[phase]) {
        if (st[phase].fault === 'loose') return retighten(j, phase, power, tool);
        return log('warn', 'That one is already done.');
      }
      return log('warn', 'Not yet — that fastener belongs to a later step.', { code: 'order' });
    }
    if (phase === 'lock' && (!isPlaced(j.a) || (j.b && !isPlaced(j.b)))) {
      return log('warn', 'Both parts have to be in place before that can be tightened.', { code: 'order' });
    }

    let fault;
    if (tool !== spec.driver) {
      state.stats.toolErrors++;
      fault = 'camout';
    } else if (power > spec.strip) {
      fault = j.type === 'dowel' || spec.driver === 'mallet' ? 'split' : 'stripped';
    } else if (power < spec.band[0]) {
      fault = 'loose';
    } else {
      fault = 'good';
    }
    const outcome = FAULTS[fault];
    st[phase] = { quality: outcome.quality, fault, power, tool, at: Date.now() };
    state.stats.torque.push({ jointId, phase, power, band: spec.band, fault });
    if (fault !== 'good' && fault !== 'loose') state.stats.damage.push({ jointId, fault });
    if (jointEffective(j)) st.mated = true;
    settle();

    const label = FASTENERS[j.type].name;
    const kind = fault === 'good' ? 'ok' : fault === 'loose' ? 'warn' : 'bad';
    const text = fault === 'good'
      ? `${label} — in spec.`
      : fault === 'camout'
        ? `${label}: wrong driver (${tool}). ${outcome.why}`
        : `${label}: ${outcome.label.toLowerCase()}. ${outcome.why}`;
    return log(kind, text, { jointId, phase, fault, power });
  }

  function retighten(j, phase, power, tool) {
    const st = state.jointState.get(j.id);
    const spec = j[phase];
    state.stats.redos++;
    if (tool !== spec.driver) { state.stats.toolErrors++; return log('bad', 'Wrong driver again — leave it alone before you ruin it.'); }
    const fault = power > spec.strip ? 'stripped' : power < spec.band[0] ? 'loose' : 'good';
    if (fault === 'good') {
      st[phase] = { quality: FAULTS.good.quality, fault, power, tool, at: Date.now() };
      settle();
      return log('ok', 'Retightened — now in spec.', { jointId: j.id, phase, fault });
    }
    if (fault === 'stripped') {
      st[phase] = { quality: FAULTS.stripped.quality, fault, power, tool, at: Date.now() };
      state.stats.damage.push({ jointId: j.id, fault });
      settle();
      return log('bad', 'Too far. Stripped it.', { jointId: j.id, phase, fault });
    }
    return log('warn', 'Still loose.', { jointId: j.id, phase, fault });
  }

  function tickBom(partId) {
    state.checked.add(partId);
    settle();
    return log('ok', `${partName(partId)} accounted for.`);
  }

  /** The try-square step: reports every carcass joint that is not pulled up tight. */
  function checkSquare() {
    const step = openSteps().find((s) => s.op === 'check');
    const loose = carcassLooseJoints();
    state.squareChecked = true;
    if (step) settle();
    return loose.length
      ? log('warn', `Out of square: ${loose.length} joint${loose.length > 1 ? 's are' : ' is'} not pulled up tight. Tighten before the back goes on.`,
        { code: 'racked', joints: loose.map((j) => j.id) })
      : log('ok', 'Diagonals match. The carcass is square.', { code: 'square' });
  }

  function carcassLooseJoints() {
    return [...joints.values()].filter((j) => {
      if (j.group && j.group !== 'carcass') return false;
      if (!isPlaced(j.a) || (j.b && !isPlaced(j.b))) return false;
      if (j.lock && !state.jointState.get(j.id).lock) return true;
      return jointQuality(j) < 0.9;
    });
  }

  /** Hinge / gap adjustment: the player dials a value, we score it against spec. */
  function adjust(stepId, value) {
    const step = stepById.get(stepId);
    const [lo, hi] = step.band ?? [0.45, 0.55];
    state.hingeGap = value;
    const ok = value >= lo && value <= hi;
    settle();
    return ok
      ? log('ok', `Door gap ${(value * 6).toFixed(1)} mm — even top and bottom.`, { stepId })
      : log('warn', `Door gap ${(value * 6).toFixed(1)} mm — spec is ${(lo * 6).toFixed(1)}–${(hi * 6).toFixed(1)} mm. Keep turning.`, { stepId });
  }

  // ---------------------------------------------------------- step engine ---

  function stepSatisfied(s) {
    switch (s.op) {
      case 'bom':    return kit.parts.every((p) => state.checked.has(p.id));
      case 'place':  return s.slots.every((id) => isPlaced(id));
      case 'insert': return s.joints.every((id) => !!state.jointState.get(id).pre);
      case 'fasten': return s.joints.every((id) => !!state.jointState.get(id).lock);
      case 'check':  return state.squareChecked;
      case 'adjust': return state.hingeGap != null && state.hingeGap >= (s.band?.[0] ?? 0)
        && state.hingeGap <= (s.band?.[1] ?? 1);
      case 'finish': return state.finishedAt != null;
      default:       return false;
    }
  }

  /** Recompute which steps are now done. Called after every mutating action. */
  function settle() {
    let changed = true;
    while (changed) {
      changed = false;
      for (const s of steps) {
        if (state.completed.has(s.id)) continue;
        if (!s.requires.every((r) => state.completed.has(r))) continue;
        if (!stepSatisfied(s)) continue;
        state.completed.add(s.id);
        changed = true;
        if (s.squares) bakeSquareness();
      }
    }
  }

  /**
   * The back panel is what stops a carcass racking. Fasten it while the frame is
   * still loose and the error is locked in for good.
   */
  function bakeSquareness() {
    const loose = carcassLooseJoints().length;
    const total = Math.max(1, [...joints.values()].filter((j) => !j.group || j.group === 'carcass').length);
    state.squareness = Math.max(0.2, 1 - (loose / total) * 2.2);
  }

  function finish() {
    if (state.finishedAt) return log('warn', 'Already finished.');
    state.finishedAt = Date.now();
    settle();
    return log('ok', 'Build complete.');
  }

  const partName = (id) => kit.parts.find((p) => p.id === id)?.name ?? id;

  // ----------------------------------------------------------- transforms ---

  /** Where a slot's part actually sits right now (or would sit, for a ghost). */
  function transformOf(slotId, orientationId) {
    const slot = slots.get(slotId);
    const placed = state.placed.get(slotId);
    const rot = orientationId
      ? (orientationOptions(slotId).find((o) => o.id === orientationId)?.rot ?? slot.rot)
      : (placed?.rot ?? slot.rot);
    return { pos: slot.pos, rot };
  }

  // ------------------------------------------------------------- persist ----

  const serialize = () => ({
    kitId: kit.id, seed,
    placed: [...state.placed],
    jointState: [...state.jointState],
    checked: [...state.checked],
    completed: [...state.completed],
    squareness: state.squareness, squareChecked: state.squareChecked, hingeGap: state.hingeGap,
    startedAt: state.startedAt, finishedAt: state.finishedAt, stats: state.stats,
  });

  function restore(snap) {
    if (!snap || snap.kitId !== kit.id) return false;
    state.placed = new Map(snap.placed);
    state.jointState = new Map(snap.jointState);
    state.checked = new Set(snap.checked);
    state.completed = new Set(snap.completed);
    Object.assign(state, {
      squareness: snap.squareness, squareChecked: snap.squareChecked, hingeGap: snap.hingeGap,
      startedAt: snap.startedAt, finishedAt: snap.finishedAt, stats: snap.stats,
    });
    return true;
  }

  return {
    kit, state, slots, joints, steps, assist,
    holesFor: (slotId) => holesBySlot.get(slotId) ?? [],
    openSteps, stepStatus, stepById, orientationOptions, misalignment,
    jointsOfSlot, isPlaced, jointEffective, jointQuality, carcassLooseJoints,
    place, unplace, drive, tickBom, checkSquare, adjust, finish, transformOf,
    partName, serialize, restore,
    progress: () => state.completed.size / steps.length,
  };
}
