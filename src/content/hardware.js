// Tools and fastener classes. Kits reference these by id; the engine reads
// constraint counts and the renderer reads the geometry hints.

export const TOOLS = {
  hand:     { id: 'hand',     name: 'Hands',           key: '1', glyph: '✋', hint: 'Finger tight. Good enough for hanger bolts and shelf pins.' },
  allen:    { id: 'allen',    name: 'Hex key 4 mm',    key: '2', glyph: '⌐',  hint: 'Cam locks. Half a turn does it — the cam is an eccentric, not a screw.' },
  phillips: { id: 'phillips', name: 'Screwdriver PZ2', key: '3', glyph: '✚',  hint: 'Cam bolts, hinge plates, back-panel screws. Keep it square or it cams out.' },
  mallet:   { id: 'mallet',   name: 'Rubber mallet',   key: '4', glyph: '🔨', hint: 'Dowels and panel pins. Tap, do not swing.' },
  square:   { id: 'square',   name: 'Try square',      key: '5', glyph: '📐', hint: 'Check the carcass for square before the back goes on.' },
};

/**
 * Fastener classes.
 *  constraints — degrees of freedom this joint removes at full quality; used by
 *                sim/rigidity.js. A dowel pins two axes, a cam pins three.
 *  geom        — hints for render/hardwaremesh.js (mm).
 */
export const FASTENERS = {
  dowel: {
    id: 'dowel', name: 'Wooden dowel 8 × 35', article: '101.350.42',
    constraints: 2, geom: { dia: 8, len: 35, color: 0xc9a227, shape: 'dowel' },
    holeA: { dia: 8, depth: 18 }, holeB: { dia: 8, depth: 20 },
  },
  cam: {
    id: 'cam', driveFromFarFace: true, name: 'Cam lock 15 mm + bolt', article: '119.343.90',
    constraints: 3, geom: { dia: 15, len: 12, boltDia: 7, boltLen: 34, color: 0xb9bec6, shape: 'cam' },
    holeA: { dia: 15, depth: 13 }, holeB: { dia: 7, depth: 24 },
  },
  screw: {
    id: 'screw', driveFromFarFace: true, name: 'Confirmat screw 6.3 × 50', article: '100.028.51',
    constraints: 3, geom: { dia: 6.3, len: 50, head: 10, color: 0x8e959e, shape: 'screw' },
    holeA: { dia: 7, depth: 6 }, holeB: { dia: 5, depth: 40 },
  },
  nail: {
    id: 'nail', driveFromFarFace: true, name: 'Panel pin 1.5 × 20', article: '101.011.19',
    constraints: 1, geom: { dia: 1.6, len: 20, head: 3.2, color: 0x6f767f, shape: 'nail' },
    holeA: { dia: 2, depth: 1 }, holeB: null,
  },
  hinge: {
    id: 'hinge', name: 'Concealed hinge 110°', article: '302.451.62',
    constraints: 2, geom: { cup: 35, plate: [45, 16, 3], color: 0xc7ccd3, shape: 'hinge' },
    holeA: { dia: 35, depth: 12 }, holeB: { dia: 5, depth: 10 },
  },
  legscrew: {
    id: 'legscrew', name: 'Hanger bolt M8 leg', article: '103.221.75',
    constraints: 3, geom: { dia: 8, len: 25, color: 0x9aa1a9, shape: 'screw' },
    holeA: { dia: 8, depth: 22 }, holeB: { dia: 8, depth: 20 },
  },
  pin: {
    id: 'pin', name: 'Shelf pin 5 mm', article: '100.435.17',
    constraints: 2, geom: { dia: 5, len: 16, color: 0xb3b8bf, shape: 'dowel' },
    holeA: { dia: 5, depth: 12 }, holeB: null,
  },
  rail: {
    id: 'rail', name: 'Rail bracket', article: '104.771.03',
    constraints: 2, geom: { dia: 20, len: 10, color: 0xc7ccd3, shape: 'cam' },
    holeA: { dia: 20, depth: 4 }, holeB: { dia: 20, depth: 2 },
  },
};

export const MATERIALS = {
  white:     { color: 0xe9e6df, edge: 0xbdb8ae, name: 'White laminate' },
  oak:       { color: 0xc79a63, edge: 0x8d6b3f, name: 'Oak veneer' },
  hardboard: { color: 0x9c7a55, edge: 0x6d5238, name: 'Hardboard' },
  steel:     { color: 0xa9b0b8, edge: 0x767c84, name: 'Powder-coated steel' },
  plastic:   { color: 0x3b3f46, edge: 0x24272b, name: 'ABS' },
  pine:      { color: 0xd8bb8b, edge: 0xa88a5c, name: 'Solid pine' },
};

/** Damage outcomes, keyed by what the player did wrong. */
export const FAULTS = {
  camout:    { quality: 0.45, label: 'Cammed out', why: 'Wrong driver — the recess is chewed and the fastener will never pull up tight.' },
  stripped:  { quality: 0.30, label: 'Stripped',   why: 'Over-torqued. The thread has torn out of the chipboard; nothing left to bite on.' },
  split:     { quality: 0.35, label: 'Split',      why: 'Struck too hard. The panel edge is split around the hole.' },
  loose:     { quality: 0.55, label: 'Loose',      why: 'Under-torqued. It holds, but the joint can still move under load.' },
  good:      { quality: 1.00, label: 'Good',       why: 'Seated and torqued within spec.' },
};
