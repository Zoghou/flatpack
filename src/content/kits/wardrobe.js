// KLÄDVIK wardrobe — the main kit.
// 800 W × 580 D × 2000 H carcass, one door on concealed hinges, a shelf on pins
// and a hanging rail. Origin: floor level, centre of the footprint. Units mm.

import { part, slot, interfaceDC, nail, pin, railBracket, hinge, step } from './_build.js';

const T = 16;
const W = 800, D = 580, H = 2000;
const SIDE_H = H - T;                 // 1984 — the top panel caps the sides
const XS = W / 2 - T / 2;             // 392 — side panel mid-thickness
const XI = W / 2 - T;                 // 384 — inner face
const ZF = 200, ZB = -200;            // dowel forward, cam aft
const Y_TOP = H - T / 2;              // 1992
const Y_SHELF = 1500, Y_RAIL = 1400;
const HINGE_X = -376;

export default {
  id: 'wardrobe',
  name: 'KLÄDVIK',
  product: 'Wardrobe, 1 door, shelf and rail',
  price: 189,
  difficulty: 3,
  parTimeMs: 22 * 60_000,
  blurb: 'Two metres of carcass that has to end up square, flat and plumb, then a door that has to hang with an even gap down its whole length. This is the one that separates people who read the booklet from people who do not.',
  assembled: { w: W, d: D, h: H },
  clearance: [
    { face: 'front', depth: 620, why: 'the door swings 110°' },
    { face: 'top', gap: 90, why: 'you have to tilt it upright — check the ceiling' },
  ],

  parts: [
    part('200.114.03', 'Side panel', [D, SIDE_H, T], { note: 'Two of them. Line drilling for shelf pins up the inner face.' }),
    part('200.114.11', 'Base panel', [W - 2 * T, T, D]),
    part('200.114.12', 'Top panel', [W, T, D], { note: 'Overhangs the sides.' }),
    part('200.114.20', 'Back panel', [W, SIDE_H, 3], { material: 'hardboard', kind: 'board', note: '3 mm hardboard, 10 pins. The only thing carrying shear across two metres.' }),
    part('200.114.31', 'Shelf', [W - 2 * T, T, D], { note: 'Rests on four pins. It is meant to lift out.' }),
    part('200.114.44', 'Hanging rail', [W - 2 * T - 32, 30, 30], { material: 'steel', kind: 'rail' }),
    part('200.114.50', 'Door', [W - 12, H - 40, 18], { material: 'oak', kind: 'door', note: '35 mm cup holes, 22 mm in from the hinge edge.' }),
  ],

  slots: [
    slot('side-l', '200.114.03', [-XS, SIDE_H / 2, 0], [0, 90, 0], { flips: ['x180', 'y180'], anchor: true }),
    slot('side-r', '200.114.03', [XS, SIDE_H / 2, 0], [0, 90, 0], { flips: ['x180', 'y180'] }),
    slot('base', '200.114.11', [0, T / 2, 0], [0, 0, 0], { flips: ['y180', 'x180'] }),
    slot('top', '200.114.12', [0, Y_TOP, 0], [0, 0, 0], { flips: ['x180', 'y180'] }),
    slot('back', '200.114.20', [0, SIDE_H / 2, -D / 2 - 1.5], [0, 0, 0], { flips: ['y180'], group: 'back' }),
    slot('shelf', '200.114.31', [0, Y_SHELF, 0], [0, 0, 0], { flips: ['y180'], group: 'fittings', freeBy: 'lift-out' }),
    slot('rail', '200.114.44', [0, Y_RAIL, 0], [0, 0, 0], { group: 'fittings', freeBy: 'lift-out' }),
    slot('door', '200.114.50', [0, H / 2, D / 2 + 9], [0, 0, 0], { flips: ['y180', 'x180'], group: 'door', freeBy: 'hinge' }),
  ],

  joints: [
    ...interfaceDC('base-l', 'side-l', 'base', 'x', [-XI, T / 2, ZF], [-XI, T / 2, ZB]),
    ...interfaceDC('base-r', 'side-r', 'base', 'x', [XI, T / 2, ZF], [XI, T / 2, ZB]),
    ...interfaceDC('top-l', 'top', 'side-l', 'y', [-XS, SIDE_H, ZF], [-XS, SIDE_H, ZB]),
    ...interfaceDC('top-r', 'top', 'side-r', 'y', [XS, SIDE_H, ZF], [XS, SIDE_H, ZB]),

    nail('back-l1', 'back', 'side-l', [-XS, 300, -D / 2], 'z'),
    nail('back-l2', 'back', 'side-l', [-XS, 1000, -D / 2], 'z'),
    nail('back-l3', 'back', 'side-l', [-XS, 1700, -D / 2], 'z'),
    nail('back-r1', 'back', 'side-r', [XS, 300, -D / 2], 'z'),
    nail('back-r2', 'back', 'side-r', [XS, 1000, -D / 2], 'z'),
    nail('back-r3', 'back', 'side-r', [XS, 1700, -D / 2], 'z'),
    nail('back-t1', 'back', 'top', [-200, Y_TOP, -D / 2], 'z'),
    nail('back-t2', 'back', 'top', [200, Y_TOP, -D / 2], 'z'),
    nail('back-b1', 'back', 'base', [-200, T / 2, -D / 2], 'z'),
    nail('back-b2', 'back', 'base', [200, T / 2, -D / 2], 'z'),

    pin('pin-lf', 'shelf', 'side-l', [-XI, Y_SHELF, 180], 'x'),
    pin('pin-lb', 'shelf', 'side-l', [-XI, Y_SHELF, -180], 'x'),
    pin('pin-rf', 'shelf', 'side-r', [XI, Y_SHELF, 180], 'x'),
    pin('pin-rb', 'shelf', 'side-r', [XI, Y_SHELF, -180], 'x'),

    railBracket('rail-l', 'rail', 'side-l', [-XI, Y_RAIL, 0], 'x'),
    railBracket('rail-r', 'rail', 'side-r', [XI, Y_RAIL, 0], 'x'),

    hinge('hinge-lo', 'door', 'side-l', [HINGE_X, 300, D / 2], 'z'),
    hinge('hinge-hi', 'door', 'side-l', [HINGE_X, 1700, D / 2], 'z'),
  ],

  steps: [
    step('s0', 'bom', {
      title: 'Check the contents',
      teach: 'Twenty-two kilos of board and 24 fasteners. The one you will be short of is always the one you need at step fourteen.',
    }),
    step('s1', 'insert', {
      title: 'Dowels into both ends of the base',
      requires: ['s0'], tool: 'mallet', joints: ['base-l-d', 'base-r-d'],
      teach: 'Work on the floor, on the flat cardboard the kit came in. A two-metre carcass assembled upright will rack under its own weight before you get a cam turned.',
    }),
    step('s2', 'insert', {
      title: 'Cam bolts into both ends of the base',
      requires: ['s0'], tool: 'phillips', joints: ['base-l-c', 'base-r-c'],
    }),
    step('s3', 'place', { title: 'Left side panel down', requires: ['s0'], slots: ['side-l'],
      teach: 'The line drilling for the shelf pins must face inward. Get this wrong and the pin holes end up on the outside of the wardrobe, where everyone can see them.' }),
    step('s4', 'place', { title: 'Base onto the left panel', requires: ['s1', 's2', 's3'], slots: ['base'] }),
    step('s5', 'fasten', { title: 'Turn the left base cam', requires: ['s4'], tool: 'allen', joints: ['base-l-c'] }),
    step('s6', 'place', { title: 'Right side panel on', requires: ['s5'], slots: ['side-r'] }),
    step('s7', 'fasten', { title: 'Turn the right base cam', requires: ['s6'], tool: 'allen', joints: ['base-r-c'] }),
    step('s8', 'insert', {
      title: 'Dowels and bolts into the top edges',
      requires: ['s7'], tool: 'mallet', joints: ['top-l-d', 'top-r-d', 'top-l-c', 'top-r-c'],
    }),
    step('s9', 'place', { title: 'Top panel on', requires: ['s8'], slots: ['top'] }),
    step('s10', 'fasten', { title: 'Lock the top', requires: ['s9'], tool: 'allen', joints: ['top-l-c', 'top-r-c'] }),
    step('s11', 'check', {
      title: 'Square the carcass', requires: ['s10'], tool: 'square',
      teach: 'On an 800 × 1984 rectangle the diagonals are 2139 mm. Five millimetres out here becomes a 5 mm door gap taper you will look at every single day.',
    }),
    step('s12', 'place', { title: 'Back panel on', requires: ['s11'], slots: ['back'] }),
    step('s13', 'fasten', {
      title: 'Pin the back down', requires: ['s12'], tool: 'mallet', squares: true,
      joints: ['back-l1', 'back-l2', 'back-l3', 'back-r1', 'back-r2', 'back-r3', 'back-t1', 'back-t2', 'back-b1', 'back-b2'],
      teach: 'Start at one corner, work diagonally, and check the diagonals again halfway through. This is the last moment the shape is negotiable.',
    }),
    step('s14', 'insert', { title: 'Push in the four shelf pins', requires: ['s13'], tool: 'hand', joints: ['pin-lf', 'pin-lb', 'pin-rf', 'pin-rb'] }),
    step('s15', 'place', { title: 'Rest the shelf on the pins', requires: ['s14'], slots: ['shelf'],
      teach: 'A shelf on pins is not fixed and is not meant to be. It carries load in compression and nothing else — the readout will show it as free by design.' }),
    step('s16', 'place', { title: 'Offer up the hanging rail', requires: ['s13'], slots: ['rail'] }),
    step('s17', 'fasten', { title: 'Screw the rail brackets', requires: ['s16'], tool: 'phillips', joints: ['rail-l', 'rail-r'] }),
    step('s18', 'insert', {
      title: 'Screw the hinge plates to the carcass', requires: ['s13'], tool: 'phillips', joints: ['hinge-lo', 'hinge-hi'],
      teach: 'Plates on the carcass first, cups on the door second. Doing it the other way round means holding 14 kg of door with one hand.',
    }),
    step('s19', 'place', { title: 'Hang the door', requires: ['s18'], slots: ['door'],
      teach: 'The cup holes are 22 mm in from the hinge edge — and they are not symmetrical top to bottom. Check before you take the weight.' }),
    step('s20', 'fasten', { title: 'Screw the cups home', requires: ['s19'], tool: 'phillips', joints: ['hinge-lo', 'hinge-hi'] }),
    step('s21', 'adjust', {
      title: 'Set the door gap', requires: ['s20'], tool: 'phillips', band: [0.45, 0.62],
      teach: 'A concealed hinge adjusts on three axes. The one you want here is the depth screw: turn until the gap is even top to bottom at about 3 mm.',
    }),
    step('s22', 'finish', { title: 'Wobble test', requires: ['s21', 's15', 's17'] }),
  ],
};
