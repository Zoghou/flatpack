// Plays a whole kit on a phone: 390x844, touch events only, no keyboard and no
// mouse. Every gesture goes through CDP Input.dispatchTouchEvent, so the game
// sees genuine pointerType: 'touch' — the same events a thumb produces.
// Run:  node test/mobile.mjs [kitId] [--shots]
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
const PORT = 5197;

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
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2,
});
// Seeded before any page script runs: the game saves on beforeunload, so writing
// it after load and reloading would only overwrite it again.
await ctx.addInitScript((kitId) => {
  localStorage.setItem('flatpack.save.v1', JSON.stringify({
    phase: 'shop', flatId: 'linden', budget: 620, spent: 0,
    owned: [{ kitId, built: false, result: null }], activeKitId: kitId,
    layout: {}, settings: { assist: true, seed: 20260820 }, buildSnapshot: null,
  }));
  // Proof rather than promise: if any key reaches the page, this run cheated.
  window.__keys = 0;
  addEventListener('keydown', () => { window.__keys++; }, true);
}, KIT);
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const cdp = await ctx.newCDPSession(page);

// ------------------------------------------------------------------ touch ---

const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
const finger = (x, y) => [{ x, y, radiusX: 12, radiusY: 12, force: 1 }];

async function tapPoint(x, y) {
  await touch('touchStart', finger(x, y));
  await page.waitForTimeout(60);
  await touch('touchEnd', []);
  await page.waitForTimeout(120);
}

async function tapEl(sel) {
  const el = page.locator(sel).first();
  await el.scrollIntoViewIfNeeded();       // a player scrolls the sheet; so does this
  const b = await el.boundingBox();
  if (!b) throw new Error(`nothing to tap for ${sel}`);
  await tapPoint(b.x + b.width / 2, b.y + b.height / 2);
}

/** Drag a finger across the screen — moving a piece of furniture. */
async function drag(from, to, steps = 8) {
  await touch('touchStart', finger(from.x, from.y));
  for (let i = 1; i <= steps; i++) {
    await touch('touchMove', finger(
      from.x + (to.x - from.x) * (i / steps),
      from.y + (to.y - from.y) * (i / steps),
    ));
    await page.waitForTimeout(16);
  }
  await touch('touchEnd', []);
  await page.waitForTimeout(150);
}

/** Press and hold, release when `until` resolves — driving a fastener. */
async function hold(x, y, until) {
  await touch('touchStart', finger(x, y));
  try { await until(); } finally { await touch('touchEnd', []); }
  await page.waitForTimeout(60);
}

const TABS = { Step: 'step', Order: 'steps', Parts: 'parts', Tools: 'tools', Rigidity: 'rig' };
async function openTab(name) {
  if (await page.getAttribute('.hud', 'data-tab') === TABS[name]) return;
  await tapEl(`.hud-tabs .tab:has-text("${name}")`);
}

// The gauge is watched, not timed: exactly what a player does, and immune to
// however fast this machine happens to be rendering.
const releaseAt = (target) => page.waitForFunction(
  (t) => {
    const el = document.querySelector('.gauge-value');
    return el && Number.parseInt(el.textContent, 10) >= t;
  }, Math.round(target * 100), { polling: 'raf', timeout: 8000 },
);

/** Where a scene object with this pick tag sits on screen right now. */
const pickScreen = (kind, id) => page.evaluate(([k, wanted]) => {
  const { stage, THREE } = window.__flatpack ?? window.__flatpackFurnish;
  let found = null;
  stage.world.traverse((o) => {
    const p = o.userData?.pick;
    if (!found && p?.kind === k && (wanted == null || p.id === wanted)) found = o;
  });
  if (!found) return null;
  const v = found.getWorldPosition(new THREE.Vector3()).project(stage.camera);
  const r = stage.renderer.domElement.getBoundingClientRect();
  return { x: r.left + (v.x * 0.5 + 0.5) * r.width, y: r.top + (-v.y * 0.5 + 0.5) * r.height };
}, [kind, id]);

const shot = (n) => (SHOTS ? page.screenshot({ path: join(shotDir, `phone-${n}.png`) }) : Promise.resolve());

try {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
  await shot('01-title');
  check('the title offers touch controls, not shortcuts',
    await page.locator('.title-touch').isVisible() && !(await page.locator('.title-keys').isVisible()));

  await tapEl('.title-actions .btn.primary');            // Continue into the seeded save
  await page.waitForSelector('.bench-row');
  await tapEl('text=Build it');
  await page.waitForSelector('.step-card h2');
  check('the build phase opens on a phone', await page.locator('.booklet-canvas').count() === 1);
  check('the panels start as a sheet', await page.getAttribute('.hud', 'data-tab') === 'step');
  await shot('02-build');

  const stepInfo = () => page.evaluate(() => {
    const { asm } = window.__flatpack;
    const s = asm.openSteps()[0];
    if (!s) return null;
    return { id: s.id, op: s.op, tool: s.tool, title: s.title, band: s.band, slots: s.slots ?? [], joints: s.joints ?? [] };
  });

  let guard = 0, lastId = null, repeats = 0, step, tappedGhost = false;
  while ((step = await stepInfo()) && guard++ < 90) {
    if (step.id === lastId) repeats++; else { repeats = 0; lastId = step.id; }
    if (repeats > 1) {
      const toast = await page.locator('.toast').last().innerText().catch(() => '');
      throw new Error(`stuck on ${step.id} (${step.op}) "${step.title}" — last message: ${toast}`);
    }
    console.log(`   · ${step.id} ${step.op} — ${step.title}`);

    if (step.op === 'bom') {
      await openTab('Parts');
      const n = await page.locator('.bom-list .bom-row').count();
      for (let i = 0; i < n; i++) await tapEl(`.bom-list .bom-row >> nth=${i}`);
    } else if (step.op === 'place') {
      for (const slotId of step.slots) {
        const info = await page.evaluate((sid) => {
          const { asm } = window.__flatpack;
          if (asm.isPlaced(sid)) return null;
          const opts = asm.orientationOptions(sid);
          return { partId: asm.slots.get(sid).part, correct: opts.findIndex((o) => o.correct), turns: opts.length };
        }, slotId);
        if (!info) continue;
        await openTab('Parts');
        await tapEl(`.bom-list .bom-row:has-text("${info.partId}")`);
        // picking a part collapses the sheet so the model is visible
        check(`picking ${info.partId} clears the sheet`, await page.getAttribute('.hud', 'data-tab') === 'none');
        for (let i = 0; i < info.correct; i++) await tapEl('.act-row .btn:has-text("Turn it")');
        if (!tappedGhost) {
          // once, place it by tapping the ghost in the 3D view rather than the
          // button — that is the path a player takes, and the one that breaks
          // if tap-versus-orbit ever regresses
          const pt = await pickScreen('ghost', null);
          if (pt) { await tapPoint(pt.x, pt.y); tappedGhost = true; }
        }
        if (await page.locator('.act-bar:not(.hidden)').count()) await tapEl('.act-row .btn:has-text("Fit it here")');
        await page.waitForTimeout(60);
      }
    } else if (step.op === 'insert' || step.op === 'fasten') {
      const phase = step.op === 'insert' ? 'pre' : 'lock';
      for (const jid of step.joints) {
        const spec = await page.evaluate(([id, ph]) => {
          const j = window.__flatpack.asm.joints.get(id);
          const st = window.__flatpack.asm.state.jointState.get(id);
          return st[ph] ? null : { band: j[ph].band, driver: j[ph].driver };
        }, [jid, phase]);
        if (!spec) continue;
        await openTab('Tools');
        await tapEl(`.tool[data-tool="${spec.driver}"]`);
        await tapEl('.hud-tabs .tab.on');                 // collapse to see the model
        const pt = await pickScreen('joint', jid);
        if (!pt) { failures++; console.log(`  FAIL  no marker on screen for ${jid}`); continue; }
        await hold(pt.x, pt.y, () => releaseAt((spec.band[0] + spec.band[1]) / 2));
      }
    } else if (step.op === 'check') {
      await openTab('Tools');
      await tapEl('.tool[data-tool="square"]');
      await openTab('Step');
      await tapEl('text=Measure the diagonals');
    } else if (step.op === 'adjust') {
      await openTab('Step');
      await tapEl('text=Open the adjuster');
      const mid = Math.round(((step.band[0] + step.band[1]) / 2) * 100) / 100;
      await page.locator('.adjuster input[type=range]').fill(String(mid));   // a native control
      await tapEl('text=Lock the screw');
    } else if (step.op === 'finish') {
      await openTab('Step');
      await shot('03-assembled');
      await tapEl('text=Run the test');
      await page.waitForSelector('.report', { timeout: 15000 });
      break;
    }
    await page.waitForTimeout(40);
  }

  check('the kit went together with taps alone', await page.locator('.report').count() === 1);
  check('the ghost was tapped in the 3D view at least once', tappedGhost);
  console.log(`   grade ${await page.locator('.grade').innerText()} — ${await page.locator('.report-head .muted').innerText()}`);
  check('the report fits the screen',
    await page.evaluate(() => document.querySelector('.report').getBoundingClientRect().width <= innerWidth));
  await shot('04-report');

  // ------------------------------------------------------- furnishing ---
  // The last phase is a drag, which is the one gesture the build phase
  // deliberately treats as "not a tap" — worth proving it still works here.
  await tapEl('.overlay-actions .btn.primary');
  await page.waitForSelector('.catalog');
  await tapEl('text=Move into the bedroom');
  await page.waitForSelector('.furnish-ui');
  await tapEl('.piece-row');
  await page.waitForTimeout(700);          // selecting a piece re-frames the camera; let it settle
  const before = await page.evaluate(() => window.__flatpackFurnish?.selected?.x);
  const piece = await pickScreen('piece', null);
  if (piece) await drag(piece, { x: piece.x + 60, y: piece.y + 40 });
  const after = await page.evaluate(() => window.__flatpackFurnish?.selected?.x);
  check('a piece can be dragged across the floor with a finger', before !== after, `${before} → ${after}`);
  await tapEl('text=Turn it 90');
  check('and turned without the R key', await page.evaluate(() => window.__flatpackFurnish?.selected?.rot) === 90);
  await shot('05-furnish');

  check('no key was pressed all game', await page.evaluate(() => window.__keys) === 0);
  check('nothing overflows sideways', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  check('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));
} catch (e) {
  failures++;
  console.log(`  FAIL  ${e.message.split('\n')[0]}`);
} finally {
  await browser.close();
  server.kill();
}

console.log(failures ? `\n${failures} FAILURE(S)` : `\n${KIT} played through on a phone`);
process.exit(failures ? 1 : 0);
