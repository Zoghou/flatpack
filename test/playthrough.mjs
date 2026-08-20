// Headless run of the assembly rules. No browser, no Three.js — this is the
// point of keeping sim/ pure. Run: node games/flatpack/test/playthrough.mjs
import nightstand from '../src/content/kits/nightstand.js';
import wardrobe from '../src/content/kits/wardrobe.js';
import bed from '../src/content/kits/bed.js';
import { createAssembly } from '../src/sim/assembly.js';
import { analyze } from '../src/sim/rigidity.js';
import { scoreBuild } from '../src/sim/scoring.js';

let failures = 0;
const check = (name, cond, extra = '') => {
  if (!cond) { failures++; console.log(`  FAIL  ${name} ${extra}`); }
  else console.log(`  ok    ${name}`);
};

/** Play a kit correctly: right part, right orientation, right tool, mid-band. */
function playPerfectly(kit, { verbose = false } = {}) {
  const asm = createAssembly(kit, { seed: 42 });
  let guard = 0;
  while (asm.state.completed.size < kit.steps.length && guard++ < 400) {
    const open = asm.openSteps();
    if (!open.length) break;
    const s = open[0];
    switch (s.op) {
      case 'bom': kit.parts.forEach((p) => asm.tickBom(p.id)); break;
      case 'place':
        for (const slotId of s.slots) {
          const right = asm.orientationOptions(slotId).find((o) => o.correct);
          const r = asm.place(slotId, right.id, asm.slots.get(slotId).part);
          if (verbose) console.log('   ', r.kind, r.text);
          if (r.kind === 'bad') failures++;
        }
        break;
      case 'insert':
      case 'fasten': {
        const phase = s.op === 'insert' ? 'pre' : 'lock';
        for (const jid of s.joints) {
          const spec = asm.joints.get(jid)[phase];
          const mid = (spec.band[0] + spec.band[1]) / 2;
          const r = asm.drive(jid, phase, mid, spec.driver);
          if (verbose) console.log('   ', r.kind, r.text);
          if (r.kind !== 'ok') failures++;
        }
        break;
      }
      case 'check': asm.checkSquare(); break;
      case 'adjust': asm.adjust(s.id, (s.band[0] + s.band[1]) / 2); break;
      case 'finish': asm.finish(); break;
      default: throw new Error(`unknown op ${s.op}`);
    }
  }
  return asm;
}

for (const kit of [nightstand, wardrobe, bed]) {
  console.log(`\n== ${kit.name} — ${kit.product}`);
  console.log(`   ${kit.parts.length} parts / ${kit.slots.length} positions / ${kit.joints.length} fasteners / ${kit.steps.length} steps`);

  // Every joint and step must reference things that exist.
  const slotIds = new Set(kit.slots.map((s) => s.id));
  const jointIds = new Set(kit.joints.map((j) => j.id));
  const partIds = new Set(kit.parts.map((p) => p.id));
  check('slots reference real parts', kit.slots.every((s) => partIds.has(s.part)));
  check('joints reference real slots', kit.joints.every((j) => slotIds.has(j.a) && (!j.b || slotIds.has(j.b))));
  check('steps reference real slots/joints', kit.steps.every((s) =>
    (s.slots ?? []).every((x) => slotIds.has(x)) && (s.joints ?? []).every((x) => jointIds.has(x))));
  check('step dependencies exist', kit.steps.every((s) => s.requires.every((r) => kit.steps.some((x) => x.id === r))));
  check('every joint is used by a step', [...jointIds].every((id) =>
    kit.steps.some((s) => (s.joints ?? []).includes(id))));
  check('every slot is filled by a step', [...slotIds].every((id) =>
    kit.steps.some((s) => (s.slots ?? []).includes(id))));

  // Decoy orientations must actually be detectable.
  const asm0 = createAssembly(kit, { seed: 42 });
  const undetectable = kit.slots.filter((s) => (s.flips ?? []).some(
    (_, i) => asm0.orientationOptions(s.id).filter((o) => !o.correct)
      .some((o) => asm0.misalignment(s.id, o.rot) < 2)));
  check('every decoy orientation is detectable from the hole pattern', undetectable.length === 0,
    undetectable.map((s) => s.id).join(','));

  const asm = playPerfectly(kit);
  check('perfect run completes every step', asm.state.completed.size === kit.steps.length,
    `${asm.state.completed.size}/${kit.steps.length} — stuck at [${asm.openSteps().map((s) => s.id)}]`);

  const rig = analyze(asm);
  check('nothing is left floating', rig.floating.length === 0, rig.floating.join(','));
  check('nothing is left under-constrained', rig.underConstrained.length === 0, rig.underConstrained.join(','));
  check('every fastener is load bearing', rig.jointsDone === rig.jointsTotal, `${rig.jointsDone}/${rig.jointsTotal}`);
  check('carcass is square', rig.squareness === 1);
  const res = scoreBuild(asm, rig);
  check('perfect run grades A or better', ['S', 'A'].includes(res.grade), `${res.grade} (${res.score})`);
  console.log(`   stiffness ${(rig.stiffness * 100).toFixed(0)}%  grade ${res.grade} ${res.score}/100`);

  // Wrong tool, wrong orientation and wrong order must all be caught.
  const bad = createAssembly(kit, { seed: 7 });
  kit.parts.forEach((p) => bad.tickBom(p.id));
  const placeStep = kit.steps.find((s) => s.op === 'place' && s.requires.every((r) => bad.state.completed.has(r)));
  const slotId = placeStep.slots[0];
  const wrong = bad.orientationOptions(slotId).find((o) => !o.correct);
  if (wrong) {
    const r = bad.place(slotId, wrong.id, bad.slots.get(slotId).part);
    check('a flipped panel is rejected on its hole pattern', r.code === 'orientation', r.text);
  }
  const late = kit.steps.find((s) => s.op === 'fasten' && s.requires.length);
  const r2 = bad.drive(late.joints[0], 'lock', 0.6, bad.joints.get(late.joints[0]).lock.driver);
  check('fastening out of order is refused', r2.code === 'order', r2.text);
}

// A deliberately sloppy build must score worse and say why.
{
  console.log('\n== sloppy build of TÖRNBY');
  const asm = createAssembly(nightstand, { seed: 3 });
  nightstand.parts.forEach((p) => asm.tickBom(p.id));
  let guard = 0;
  while (asm.state.completed.size < nightstand.steps.length && guard++ < 400) {
    const s = asm.openSteps()[0];
    if (!s) break;
    if (s.op === 'place') s.slots.forEach((id) => asm.place(id, asm.orientationOptions(id).find((o) => o.correct).id, asm.slots.get(id).part));
    else if (s.op === 'insert' || s.op === 'fasten') {
      const phase = s.op === 'insert' ? 'pre' : 'lock';
      s.joints.forEach((jid, i) => {
        const spec = asm.joints.get(jid)[phase];
        // under-torque half of them, over-torque one, use the wrong tool once
        const power = i === 0 ? spec.band[0] - 0.2 : i === 1 ? spec.strip + 0.05 : (spec.band[0] + spec.band[1]) / 2;
        asm.drive(jid, phase, power, i === 2 ? 'mallet' : spec.driver);
      });
    } else if (s.op === 'check') asm.checkSquare();
    else if (s.op === 'adjust') asm.adjust(s.id, (s.band[0] + s.band[1]) / 2);
    else if (s.op === 'finish') asm.finish();
  }
  const rig = analyze(asm);
  const res = scoreBuild(asm, rig);
  check('sloppy build is out of square', rig.squareness < 1, String(rig.squareness));
  check('sloppy build is less stiff', rig.stiffness < 0.85, String(rig.stiffness));
  check('sloppy build grades below A', !['S', 'A'].includes(res.grade), res.grade);
  check('the report explains the damage', res.notes.length > 1);
  console.log(`   stiffness ${(rig.stiffness * 100).toFixed(0)}%  square ${(rig.squareness * 100).toFixed(0)}%  grade ${res.grade} ${res.score}/100`);
  res.notes.forEach((n) => console.log(`   · ${n}`));
}

console.log(failures ? `\n${failures} FAILURE(S)\n` : '\nall checks passed\n');
process.exit(failures ? 1 : 0);
