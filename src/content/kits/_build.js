// Authoring helpers for kits. A kit author writes panels, slots and joints;
// hole patterns, geometry, validation and the booklet all fall out of these.

export const BANDS = {
  dowel:    { driver: 'mallet',   band: [0.45, 0.75], strip: 0.88 },
  cambolt:  { driver: 'phillips', band: [0.40, 0.72], strip: 0.86 },
  camlock:  { driver: 'allen',    band: [0.55, 0.80], strip: 0.90 },
  nail:     { driver: 'mallet',   band: [0.30, 0.60], strip: 0.80 },
  screw:    { driver: 'phillips', band: [0.50, 0.78], strip: 0.88 },
  hand:     { driver: 'hand',     band: [0.50, 0.85], strip: 0.96 },
  pin:      { driver: 'hand',     band: [0.35, 0.85], strip: 0.98 },
};

export const part = (id, name, size, opts = {}) => ({
  id, name, size, kind: opts.kind ?? 'panel', material: opts.material ?? 'white',
  note: opts.note, qty: opts.qty ?? 1,
});

export const slot = (id, partId, pos, rot = [0, 0, 0], opts = {}) => ({
  ...opts,                                   // anchor, freeBy, removable, …
  id, part: partId, pos, rot,
  flips: opts.flips ?? [], group: opts.group ?? 'carcass',
});

/** A dowel: tapped into `b`'s edge, then `a` is pushed down over it. */
export const dowel = (id, a, b, pos, axis, group = 'carcass') => ({
  id, type: 'dowel', a, b, pos, axis, group,
  pre: { in: 'b', ...BANDS.dowel }, lock: null,
});

/** A cam lock: bolt into `b`'s edge, cam disc turned in `a`'s face. */
export const cam = (id, a, b, pos, axis, group = 'carcass') => ({
  id, type: 'cam', a, b, pos, axis, group,
  pre: { in: 'b', ...BANDS.cambolt }, lock: { in: 'a', ...BANDS.camlock },
});

export const nail = (id, a, b, pos, axis, group = 'back') => ({
  id, type: 'nail', a, b, pos, axis, group,
  pre: null, lock: { in: 'a', ...BANDS.nail },
});

export const screw = (id, a, b, pos, axis, group = 'carcass') => ({
  id, type: 'screw', a, b, pos, axis, group,
  pre: null, lock: { in: 'a', ...BANDS.screw },
});

export const legscrew = (id, a, b, pos, axis, group = 'legs') => ({
  id, type: 'legscrew', a, b, pos, axis, group,
  pre: null, lock: { in: 'a', ...BANDS.hand },
});

export const hinge = (id, a, b, pos, axis, group = 'door') => ({
  id, type: 'hinge', a, b, pos, axis, group,
  pre: { in: 'b', ...BANDS.screw }, lock: { in: 'a', ...BANDS.screw },
});

export const railBracket = (id, a, b, pos, axis, group = 'fittings') => ({
  id, type: 'rail', a, b, pos, axis, group,
  pre: null, lock: { in: 'a', ...BANDS.screw },
});

export const pin = (id, a, b, pos, axis, group = 'fittings') => ({
  id, type: 'pin', a, b, pos, axis, group, pre: { in: 'b', ...BANDS.pin }, lock: null,
});

/**
 * One panel-to-panel interface: a dowel for location and a cam for clamping,
 * offset differently along the interface so a flipped panel cannot fake it.
 */
export function interfaceDC(prefix, a, b, axis, dowelPos, camPos, group = 'carcass') {
  return [dowel(`${prefix}-d`, a, b, dowelPos, axis, group), cam(`${prefix}-c`, a, b, camPos, axis, group)];
}

export const step = (id, op, opts) => ({ id, op, requires: [], ...opts });
