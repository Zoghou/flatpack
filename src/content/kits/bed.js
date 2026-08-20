// NATTLIG bed frame — 1400 × 2000 mattress.
// No cams and no dowels: solid pine, confirmat screws and a slat base that
// doubles as the diagonal bracing. Origin: floor, centre of the mattress. Units mm.

import { part, slot, screw, legscrew, step } from './_build.js';

const MW = 1400, ML = 2000;          // mattress
const RT = 22;                        // rail thickness
const XR = MW / 2 + RT / 2;           // 711 — rail mid-thickness
const ZH = -(ML / 2 + RT / 2);        // -1011 — headboard
const ZF = ML / 2 + RT / 2;           // 1011 — footboard
const Y_RAIL = 250, RAIL_H = 220;
const Y_SLAT = 350, SLAT_T = 20;
const SLAT_Z = [-800, -400, 0, 400, 800];

const slatSlots = SLAT_Z.map((z, i) => slot(`slat-${i + 1}`, '300.552.09', [0, Y_SLAT, z], [0, 0, 0], { group: 'slats' }));
const slatJoints = SLAT_Z.flatMap((z, i) => [
  screw(`slat-${i + 1}-l`, `slat-${i + 1}`, 'rail-l', [-MW / 2, Y_SLAT - SLAT_T / 2, z], 'y', 'slats'),
  screw(`slat-${i + 1}-r`, `slat-${i + 1}`, 'rail-r', [MW / 2, Y_SLAT - SLAT_T / 2, z], 'y', 'slats'),
]);

export default {
  id: 'bed',
  name: 'NATTLIG',
  product: 'Bed frame 140 × 200 with slat base',
  price: 149,
  difficulty: 2,
  parTimeMs: 14 * 60_000,
  blurb: 'Four boards and a slat base. Simple — until you notice that nothing stops the frame folding into a parallelogram except the slats you screw down last.',
  assembled: { w: MW + 2 * RT, d: ML + 2 * RT, h: 1000 },
  clearance: [
    { face: 'front', depth: 600, why: 'get in and out of it' },
    { face: 'left', depth: 300, why: 'change the sheets' },
  ],

  parts: [
    part('300.552.01', 'Headboard', [MW + 2 * RT, 1000, RT], { material: 'pine' }),
    part('300.552.02', 'Footboard', [MW + 2 * RT, 450, RT], { material: 'pine' }),
    part('300.552.05', 'Side rail', [ML, RAIL_H, RT], { material: 'pine', note: 'Two of them. Pre-drilled 5 mm pilot holes along the top edge for the slats.' }),
    part('300.552.09', 'Slat', [MW, SLAT_T, 90], { material: 'pine', note: 'Five. The crown goes up — a slat laid the other way is working against its own bend.' }),
    part('300.552.14', 'Centre leg', [60, Y_SLAT - SLAT_T, 60], { material: 'pine' }),
  ],

  slots: [
    slot('head', '300.552.01', [0, 500, ZH], [0, 0, 0], { flips: ['y180'], anchor: true }),
    slot('foot', '300.552.02', [0, 225, ZF], [0, 0, 0], { flips: ['y180'] }),
    slot('rail-l', '300.552.05', [-XR, Y_RAIL, 0], [0, 90, 0], { flips: ['x180', 'y180'] }),
    slot('rail-r', '300.552.05', [XR, Y_RAIL, 0], [0, 90, 0], { flips: ['x180', 'y180'] }),
    ...slatSlots,
    slot('leg-c', '300.552.14', [0, (Y_SLAT - SLAT_T) / 2, 0], [0, 0, 0], { group: 'legs', freeBy: 'thread' }),
  ],

  joints: [
    screw('head-l1', 'head', 'rail-l', [-XR, 180, -ML / 2], 'z'),
    screw('head-l2', 'head', 'rail-l', [-XR, 320, -ML / 2], 'z'),
    screw('head-r1', 'head', 'rail-r', [XR, 180, -ML / 2], 'z'),
    screw('head-r2', 'head', 'rail-r', [XR, 320, -ML / 2], 'z'),
    screw('foot-l1', 'foot', 'rail-l', [-XR, 180, ML / 2], 'z'),
    screw('foot-l2', 'foot', 'rail-l', [-XR, 320, ML / 2], 'z'),
    screw('foot-r1', 'foot', 'rail-r', [XR, 180, ML / 2], 'z'),
    screw('foot-r2', 'foot', 'rail-r', [XR, 320, ML / 2], 'z'),
    ...slatJoints,
    legscrew('leg-c-s', 'leg-c', 'slat-3', [0, Y_SLAT - SLAT_T, 0], 'y', 'legs'),
  ],

  steps: [
    step('s0', 'bom', { title: 'Check the contents',
      teach: 'Five slats, ten screws, and two rails that look identical until you find the pilot holes along one edge only.' }),
    step('s1', 'place', { title: 'Stand the headboard up', requires: ['s0'], slots: ['head'] }),
    step('s2', 'place', { title: 'Stand the footboard up', requires: ['s0'], slots: ['foot'] }),
    step('s3', 'place', { title: 'Offer up both side rails', requires: ['s1', 's2'], slots: ['rail-l', 'rail-r'],
      teach: 'The pilot-hole edge goes up and inward. Upside down, the holes end up under the mattress where no screw can reach them.' }),
    step('s4', 'fasten', { title: 'Bolt the left rail', requires: ['s3'], tool: 'phillips', joints: ['head-l1', 'head-l2', 'foot-l1', 'foot-l2'],
      teach: 'Confirmat screws cut their own thread in end grain. One pass only — back one out and drive it again and the thread is gone.' }),
    step('s5', 'fasten', { title: 'Bolt the right rail', requires: ['s3'], tool: 'phillips', joints: ['head-r1', 'head-r2', 'foot-r1', 'foot-r2'] }),
    step('s6', 'check', { title: 'Square the frame', requires: ['s4', 's5'], tool: 'square',
      teach: 'Right now the frame is four bars and four pins: it will fold into a parallelogram if you lean on it. Measure both diagonals before the slats go down — they are the bracing.' }),
    step('s7', 'place', { title: 'Lay the five slats', requires: ['s6'], slots: SLAT_Z.map((_, i) => `slat-${i + 1}`) }),
    step('s8', 'fasten', { title: 'Screw the slats down', requires: ['s7'], tool: 'phillips', squares: true,
      joints: slatJoints.map((j) => j.id),
      teach: 'Ten screws, and every one of them is a shear connection. The slat base is the only thing turning this frame into a stiff box.' }),
    step('s9', 'place', { title: 'Position the centre leg', requires: ['s8'], slots: ['leg-c'] }),
    step('s10', 'fasten', { title: 'Screw the centre leg home', requires: ['s9'], tool: 'hand', joints: ['leg-c-s'],
      teach: 'A 1400 mm span under 150 kg of people and mattress deflects enough to feel. The centre leg halves the span and cuts the deflection to a sixteenth.' }),
    step('s11', 'finish', { title: 'Load test', requires: ['s10'] }),
  ],
};
