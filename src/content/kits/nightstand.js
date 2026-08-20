// TÖRNBY nightstand — the tutorial kit.
// Carcass 450 W × 400 D, 16 mm laminated board, on 120 mm screw-in legs.
// Origin: floor level, centre of the footprint. +Z is the front. Units mm.

import { part, slot, interfaceDC, nail, legscrew, step } from './_build.js';

const T = 16;                    // board thickness
const W = 450, D = 400;          // outer width / depth
const SIDE_H = 440;              // side panel height
const LEG = 120;                 // leg height
const XI = W / 2 - T;            // inner face of a side panel: 209
const XS = W / 2 - T / 2;        // side panel mid-thickness: 217
const Y_BASE = LEG + T / 2;      // 128 — base panel centre
const Y_SHELF = 340;
const Y_TOP = LEG + SIDE_H + T / 2;   // 568
const ZF = 140, ZB = -140;       // dowel forward, cam aft — deliberately asymmetric

export default {
  id: 'nightstand',
  name: 'TÖRNBY',
  product: 'Nightstand with open shelf',
  price: 59,
  difficulty: 1,
  parTimeMs: 8 * 60_000,
  blurb: 'Six boards, twelve fasteners and four legs. The kit everyone starts on, and the one that teaches you to read a hole pattern before you commit.',
  assembled: { w: W, d: D, h: LEG + SIDE_H + T },
  clearance: [{ face: 'front', depth: 350, why: 'reach the shelf' }],

  parts: [
    part('100.234.71', 'Side panel', [D, SIDE_H, T], { note: 'Two identical panels, drilled both ends.' }),
    part('101.556.02', 'Base panel', [W - 2 * T, T, D], { note: 'Four leg pilot holes underneath — this is what tells it apart from the shelf.' }),
    part('101.556.03', 'Shelf', [W - 2 * T, T, D], { note: 'Same size as the base. No leg holes.' }),
    part('100.789.44', 'Top panel', [W, T, D], { note: 'Overhangs the sides by 8 mm each way.' }),
    part('102.011.90', 'Back panel', [W, SIDE_H + T, 3], { material: 'hardboard', kind: 'board', note: '3 mm hardboard. It is not decoration — it is what stops the carcass racking.' }),
    part('103.221.75', 'Leg', [40, LEG, 40], { material: 'pine', kind: 'leg', note: 'M8 hanger bolt, hand tight only.' }),
  ],

  slots: [
    slot('side-l', '100.234.71', [-XS, LEG + SIDE_H / 2, 0], [0, 90, 0], { flips: ['x180', 'y180'], anchor: true }),
    slot('side-r', '100.234.71', [XS, LEG + SIDE_H / 2, 0], [0, 90, 0], { flips: ['x180', 'y180'] }),
    slot('base', '101.556.02', [0, Y_BASE, 0], [0, 0, 0], { flips: ['y180', 'x180'] }),
    slot('shelf', '101.556.03', [0, Y_SHELF, 0], [0, 0, 0], { flips: ['y180'] }),
    slot('top', '100.789.44', [0, Y_TOP, 0], [0, 0, 0], { flips: ['x180', 'y180'] }),
    slot('back', '102.011.90', [0, LEG + (SIDE_H + T) / 2, -D / 2 - 1.5], [0, 0, 0], { flips: ['y180'], group: 'back' }),
    slot('leg-fl', '103.221.75', [-180, LEG / 2, 155], [0, 0, 0], { group: 'legs', freeBy: 'thread' }),
    slot('leg-fr', '103.221.75', [180, LEG / 2, 155], [0, 0, 0], { group: 'legs', freeBy: 'thread' }),
    slot('leg-bl', '103.221.75', [-180, LEG / 2, -155], [0, 0, 0], { group: 'legs', freeBy: 'thread' }),
    slot('leg-br', '103.221.75', [180, LEG / 2, -155], [0, 0, 0], { group: 'legs', freeBy: 'thread' }),
  ],

  joints: [
    // base and shelf into the sides: dowel forward for location, cam aft for clamp
    ...interfaceDC('base-l', 'side-l', 'base', 'x', [-XI, Y_BASE, ZF], [-XI, Y_BASE, ZB]),
    ...interfaceDC('base-r', 'side-r', 'base', 'x', [XI, Y_BASE, ZF], [XI, Y_BASE, ZB]),
    ...interfaceDC('shelf-l', 'side-l', 'shelf', 'x', [-XI, Y_SHELF, ZF], [-XI, Y_SHELF, ZB]),
    ...interfaceDC('shelf-r', 'side-r', 'shelf', 'x', [XI, Y_SHELF, ZF], [XI, Y_SHELF, ZB]),
    // top down onto the side panel edges
    ...interfaceDC('top-l', 'top', 'side-l', 'y', [-XS, LEG + SIDE_H, ZF], [-XS, LEG + SIDE_H, ZB]),
    ...interfaceDC('top-r', 'top', 'side-r', 'y', [XS, LEG + SIDE_H, ZF], [XS, LEG + SIDE_H, ZB]),
    // back panel pinned to the rear edges — this is the squaring member
    nail('back-l1', 'back', 'side-l', [-XS, 200, -D / 2], 'z'),
    nail('back-l2', 'back', 'side-l', [-XS, 480, -D / 2], 'z'),
    nail('back-r1', 'back', 'side-r', [XS, 200, -D / 2], 'z'),
    nail('back-r2', 'back', 'side-r', [XS, 480, -D / 2], 'z'),
    nail('back-t1', 'back', 'top', [-120, Y_TOP, -D / 2], 'z'),
    nail('back-t2', 'back', 'top', [120, Y_TOP, -D / 2], 'z'),
    nail('back-b1', 'back', 'base', [-120, Y_BASE, -D / 2], 'z'),
    nail('back-b2', 'back', 'base', [120, Y_BASE, -D / 2], 'z'),
    // legs into the underside of the base
    legscrew('leg-fl-s', 'leg-fl', 'base', [-180, LEG, 155], 'y'),
    legscrew('leg-fr-s', 'leg-fr', 'base', [180, LEG, 155], 'y'),
    legscrew('leg-bl-s', 'leg-bl', 'base', [-180, LEG, -155], 'y'),
    legscrew('leg-br-s', 'leg-br', 'base', [180, LEG, -155], 'y'),
  ],

  steps: [
    step('s0', 'bom', {
      title: 'Check the contents',
      blurb: 'Tick every part off against the list before you start.',
      teach: 'Two of these boards are the same size and different parts. Count first; a missing panel found at step nine costs you the whole afternoon.',
    }),
    step('s1', 'insert', {
      title: 'Tap the dowels into the base and shelf',
      requires: ['s0'], tool: 'mallet',
      joints: ['base-l-d', 'base-r-d', 'shelf-l-d', 'shelf-r-d'],
      teach: 'The dowel locates the joint; it carries shear, not clamp. Tap until the shoulder is flush — swing at it and you split the edge.',
    }),
    step('s2', 'insert', {
      title: 'Run the cam bolts into the base and shelf',
      requires: ['s0'], tool: 'phillips',
      joints: ['base-l-c', 'base-r-c', 'shelf-l-c', 'shelf-r-c'],
      teach: 'The bolt must go in until its collar stands proud by 11 mm. Too deep and the cam cannot reach the neck to pull it.',
    }),
    step('s3', 'place', {
      title: 'Lay the left side panel down',
      requires: ['s0'], slots: ['side-l'],
      teach: 'Both side panels are the same part. Which way up it goes is decided by the hole pattern: the 15 mm cam holes must face inward and the dowel holes sit toward the front.',
    }),
    step('s4', 'place', {
      title: 'Push the base and shelf onto the left panel',
      requires: ['s1', 's2', 's3'], slots: ['base', 'shelf'],
      teach: 'Base and shelf are identical in size. Only the base carries the four leg pilot holes.',
    }),
    step('s5', 'fasten', {
      title: 'Turn the two cams on the left side',
      requires: ['s4'], tool: 'allen',
      joints: ['base-l-c', 'shelf-l-c'],
      teach: 'Half a turn clockwise. The cam is an eccentric: it pulls about 3 mm and then stops. Keep leaning on it past that and you shear the housing out of the chipboard.',
    }),
    step('s6', 'place', {
      title: 'Bring the right side panel over',
      requires: ['s5'], slots: ['side-r'],
      teach: 'Mirror of the left. Same part, opposite way up.',
    }),
    step('s7', 'fasten', {
      title: 'Turn the two cams on the right side',
      requires: ['s6'], tool: 'allen', joints: ['base-r-c', 'shelf-r-c'],
      teach: 'The carcass is now a four-bar linkage: rigid in bending, free to rack in its own plane. The back panel fixes that later.',
    }),
    step('s8', 'insert', {
      title: 'Dowels and bolts into the top edges',
      requires: ['s7'], tool: 'mallet',
      joints: ['top-l-d', 'top-r-d', 'top-l-c', 'top-r-c'],
      teach: 'Dowels with the mallet, cam bolts with the driver. The tool rack will not stop you using the wrong one — the joint will.',
    }),
    step('s9', 'place', {
      title: 'Drop the top panel on',
      requires: ['s8'], slots: ['top'],
      teach: 'The top overhangs 8 mm on each side. Front and back are not the same: the cam holes are visible from above only if it is the right way up.',
    }),
    step('s10', 'fasten', {
      title: 'Lock the top down',
      requires: ['s9'], tool: 'allen', joints: ['top-l-c', 'top-r-c'],
    }),
    step('s11', 'check', {
      title: 'Square the carcass',
      requires: ['s10'], tool: 'square',
      teach: 'Measure both diagonals. Equal diagonals mean a square rectangle — there is no other test you can do with one tool this cheap.',
    }),
    step('s12', 'place', {
      title: 'Lay the back panel on',
      requires: ['s11'], slots: ['back'],
      teach: 'A 3 mm sheet of hardboard is worth more than every cam in the box: in shear it is the only thing resisting racking.',
    }),
    step('s13', 'fasten', {
      title: 'Pin the back panel down',
      requires: ['s12'], tool: 'mallet', squares: true,
      joints: ['back-l1', 'back-l2', 'back-r1', 'back-r2', 'back-t1', 'back-t2', 'back-b1', 'back-b2'],
      teach: 'Whatever shape the carcass is in right now is the shape it keeps. Pin a corner out of square and it stays out of square for good.',
    }),
    step('s14', 'place', {
      title: 'Offer up the four legs',
      requires: ['s13'], slots: ['leg-fl', 'leg-fr', 'leg-bl', 'leg-br'],
    }),
    step('s15', 'fasten', {
      title: 'Screw the legs home by hand',
      requires: ['s14'], tool: 'hand', joints: ['leg-fl-s', 'leg-fr-s', 'leg-bl-s', 'leg-br-s'],
      teach: 'Hand tight. A hanger bolt in chipboard has one chance at a thread — a spanner on this is how you end up with a wobbly leg forever.',
    }),
    step('s16', 'finish', {
      title: 'Wobble test',
      requires: ['s15'],
      teach: 'Push it sideways at the top corner. What moves, and how much, is exactly what the constraint readout has been telling you all along.',
    }),
  ],
};
