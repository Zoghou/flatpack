// Plays a whole kit through the real browser UI — every click, key and
// hold-to-torque a player would do — and checks it ends in a graded report.
// Run:  node games/flatpack/test/fullplay.mjs [kitId] [--shots]
// playwright is not a dependency of this repo. Point PLAYWRIGHT_MODULE at an
// installed copy, or install playwright-core somewhere node can resolve it.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = process.argv[2]?.startsWith('--') ? 'nightstand' : (process.argv[2] ?? 'nightstand');
const SHOTS = process.argv.includes('--shots');
const shotDir = process.env.FLATPACK_SHOTS ?? join(tmpdir(), 'flatpack-shots');
mkdirSync(shotDir, { recursive: true });
const PORT = 5198;

const server = spawn(process.execPath, [join(HERE, '..', 'serve.mjs')], {
  env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 500));

const errors = [];
let failures = 0;
const check = (n, c, x = '') => { if (!c) { failures++; console.log(`  FAIL  ${n} ${x}`); } else console.log(`  ok    ${n}`); };

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
// Seed the save before any page script runs: the game writes on beforeunload, so
// setting it after load and reloading would just be overwritten again.
await page.addInitScript((kitId) => {
  localStorage.setItem('flatpack.save.v1', JSON.stringify({
    phase: 'shop', flatId: 'linden', budget: 620, spent: 0,
    owned: [{ kitId, built: false, result: null }], activeKitId: kitId,
    layout: {}, settings: { assist: true, seed: 20260820 }, buildSnapshot: null,
  }));
}, KIT);
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const TOOL_KEY = { hand: '1', allen: '2', phillips: '3', mallet: '4', square: '5' };
// The gauge is watched, not timed — exactly what a player does, and immune to
// however fast this machine happens to be rendering.
const releaseAt = (page, target) => page.waitForFunction(
  (t) => {
    const el = document.querySelector('.gauge-value');
    return el && Number.parseInt(el.textContent, 10) >= t;
  }, Math.round(target * 100), { polling: 'raf', timeout: 8000 },
);

try {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
  await page.click('.title-actions .btn.primary');       // Continue into the seeded save
  await page.waitForSelector('.bench-row');
  await page.click('text=Build it');
  await page.waitForSelector('.step-card h2');

  const stepInfo = () => page.evaluate(() => {
    const { asm } = window.__flatpack;
    const open = asm.openSteps();
    const s = open[0];
    if (!s) return null;
    return {
      id: s.id, op: s.op, tool: s.tool, title: s.title, band: s.band,
      slots: s.slots ?? [], joints: s.joints ?? [],
      done: asm.state.completed.size, total: asm.steps.length,
    };
  });

  const markerScreen = (jointId) => page.evaluate((id) => {
    const { markers, stage, THREE } = window.__flatpack;
    const m = markers.children.find((c) => c.userData?.pick?.kind === 'joint' && c.userData.pick.id === id);
    if (!m) return null;
    const v = m.getWorldPosition(new THREE.Vector3()).project(stage.camera);
    const r = stage.renderer.domElement.getBoundingClientRect();
    return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
  }, jointId);

  let guard = 0;
  let step;
  let lastId = null, repeats = 0;
  while ((step = await stepInfo()) && guard++ < 90) {
    if (step.id === lastId) repeats++; else { repeats = 0; lastId = step.id; }
    if (repeats > 1) {
      const toast = await page.locator('.toast').last().innerText().catch(() => '');
      throw new Error(`stuck on ${step.id} (${step.op}) "${step.title}" — last message: ${toast}`);
    }
    console.log(`   · ${step.id} ${step.op} — ${step.title}`);
    if (step.op === 'bom') {
      const n = await page.locator('.bom-row').count();
      for (let i = 0; i < n; i++) await page.locator('.bom-row').nth(i).click();
    } else if (step.op === 'place') {
      for (const slotId of step.slots) {
        const info = await page.evaluate((sid) => {
          const { asm } = window.__flatpack;
          if (asm.isPlaced(sid)) return null;
          const opts = asm.orientationOptions(sid);
          return { partId: asm.slots.get(sid).part, correct: opts.findIndex((o) => o.correct) };
        }, slotId);
        if (!info) continue;
        await page.locator('.bom-row', { has: page.locator(`text=${info.partId}`) }).click();
        for (let i = 0; i < info.correct; i++) await page.keyboard.press('r');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(60);
      }
    } else if (step.op === 'insert' || step.op === 'fasten') {
      const phase = step.op === 'insert' ? 'pre' : 'lock';
      await page.keyboard.press(TOOL_KEY[step.tool] ?? '1');
      for (const jid of step.joints) {
        const spec = await page.evaluate(([id, ph]) => {
          const j = window.__flatpack.asm.joints.get(id);
          const st = window.__flatpack.asm.state.jointState.get(id);
          return st[ph] ? null : { band: j[ph].band, driver: j[ph].driver };
        }, [jid, phase]);
        if (!spec) continue;
        await page.keyboard.press(TOOL_KEY[spec.driver]);
        const pt = await markerScreen(jid);
        if (!pt) { failures++; console.log(`  FAIL  no marker on screen for ${jid}`); continue; }
        await page.mouse.move(pt.x, pt.y);
        await page.mouse.down();
        await releaseAt(page, (spec.band[0] + spec.band[1]) / 2);
        await page.mouse.up();
        await page.waitForTimeout(40);
      }
    } else if (step.op === 'check') {
      await page.keyboard.press('5');
      await page.click('text=Measure the diagonals');
    } else if (step.op === 'adjust') {
      await page.click('text=Open the adjuster');
      const mid = Math.round(((step.band[0] + step.band[1]) / 2) * 100) / 100;
      await page.locator('.adjuster input[type=range]').fill(String(mid));
      await page.click('text=Lock the screw');
    } else if (step.op === 'finish') {
      if (SHOTS) await page.screenshot({ path: join(shotDir, `20-${KIT}-assembled.png`) });
      await page.click('text=Run the test');
      await page.waitForSelector('.report', { timeout: 15000 });
      break;
    }
    await page.waitForTimeout(40);
  }

  check('the build reached the report card', await page.locator('.report').count() === 1);
  const grade = await page.locator('.grade').innerText();
  const score = await page.locator('.report-head .muted').innerText();
  console.log(`   grade ${grade} — ${score}`);
  check('a careful playthrough grades B or better', ['S', 'A', 'B'].includes(grade), grade);
  const facts = await page.locator('.facts').innerText();
  check('every fastener ended up carrying load', /^(\d+)\/\1\b/m.test(facts.replace(/\s+/g, '\n')) || !/0\/\d/.test(facts), facts.replace(/\n/g, ' '));
  if (SHOTS) await page.screenshot({ path: join(shotDir, `21-${KIT}-report.png`) });

  await page.click('.report >> text=Done');
  await page.waitForSelector('.catalog');
  check('the shop shows it as built', (await page.locator('.bench-row').innerText()).includes('grade'));

  await page.click('text=Move into the bedroom');
  await page.waitForSelector('.furnish-card');
  check('the furnish phase mounts', await page.locator('.piece-row').count() >= 1);
  const layoutScore = await page.locator('.furnish-score b').innerText();
  check('the layout scores', Number(layoutScore) >= 0);
  if (SHOTS) await page.screenshot({ path: join(shotDir, `22-${KIT}-furnish.png`) });
} catch (e) {
  failures++;
  console.log(`  FAIL  playthrough threw: ${e.message}`);
  if (SHOTS) await page.screenshot({ path: join(shotDir, '98-fullplay-failure.png') });
}

check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
server.kill();
console.log(failures ? `\n${failures} FAILURE(S)\n` : `\n${KIT} played through cleanly\n`);
process.exit(failures ? 1 : 0);
