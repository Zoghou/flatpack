// The single mutable game state, plus localStorage persistence.
// Anything that must survive a reload lives here; per-frame render state does not.

import { bus } from './bus.js';

const KEY = 'flatpack.save.v1';

const blank = () => ({
  phase: 'title',            // title | apartment | shop | build | furnish
  flatId: null,
  budget: 0,
  spent: 0,
  owned: [],                 // [{ kitId, built, result }]
  activeKitId: null,
  layout: {},                // kitId -> { x, z, rot }  (mm, room frame)
  furnishScore: null,
  settings: { assist: true, seed: 20260820 },
  buildSnapshot: null,       // serialised in-progress build, see sim/assembly.js
});

export const state = blank();

export function setPhase(phase, extra = {}) {
  Object.assign(state, extra);
  state.phase = phase;
  save();
  bus.emit('phase', phase);
}

export function own(kitId, price) {
  if (state.owned.some((o) => o.kitId === kitId)) return;
  state.owned.push({ kitId, built: false, result: null });
  state.spent += price;
  save();
}

export function disown(kitId, price) {
  const i = state.owned.findIndex((o) => o.kitId === kitId);
  if (i < 0) return;
  state.owned.splice(i, 1);
  state.spent -= price;
  save();
}

export function recordBuild(kitId, result) {
  const o = state.owned.find((x) => x.kitId === kitId);
  if (o) { o.built = true; o.result = result; }
  state.buildSnapshot = null;
  save();
}

export const ownedRecord = (kitId) => state.owned.find((o) => o.kitId === kitId) ?? null;
export const isBuilt = (kitId) => !!ownedRecord(kitId)?.built;

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    Object.assign(state, blank(), JSON.parse(raw));
    return true;
  } catch { return false; }
}

export function reset() {
  Object.assign(state, blank());
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  bus.emit('reset');
}
