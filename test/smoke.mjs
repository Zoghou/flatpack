// Browser smoke test: boots the game in headless Chromium, walks the phases,
// plays a few real steps and fails on any console error or page exception.
// Run:  node games/flatpack/test/smoke.mjs [--shots]
// playwright is not a dependency of this repo. Point PLAYWRIGHT_MODULE at an
// installed copy, or install playwright-core somewhere node can resolve it.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 5199;
const SHOTS = process.argv.includes('--shots');
const shotDir = process.env.FLATPACK_SHOTS ?? join(tmpdir(), 'flatpack-shots');
mkdirSync(shotDir, { recursive: true });

const server = spawn(process.execPath, [join(HERE, '..', 'serve.mjs')], {
  env: { ...process.env, PORT: String(PORT) }, stdio: 'inherit',
});
await new Promise((r) => setTimeout(r, 600));

const errors = [];
let failures = 0;
const check = (name, cond, extra = '') => {
  if (!cond) { failures++; console.log(`  FAIL  ${name} ${extra}`); } else console.log(`  ok    ${name}`);
};

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const shot = async (name) => { if (SHOTS) await page.screenshot({ path: join(shotDir, `${name}.png`) }); };

try {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
  check('title screen renders', await page.locator('.title-card h1').innerText() === 'FLATPACK');
  await shot('01-title');

  await page.click('text=New game');
  await page.waitForSelector('.listing');
  check('three flats are listed', await page.locator('.listing').count() === 3);
  await shot('02-flats');

  await page.locator('.listing', { hasText: 'Kanalweg' }).getByText('Take this one').click();
  await page.waitForSelector('.product');
  const blockedNames = await page.locator('.product.blocked h3').allInnerTexts();
  check('the low ceiling blocks the wardrobe', blockedNames.includes('KLÄDVIK'), blockedNames.join(','));
  await shot('03-shop-attic');

  await page.click('text=Look at other flats');
  await page.locator('.listing', { hasText: 'Lindenstraße' }).getByText('Take this one').click();
  await page.waitForSelector('.product');
  const blocked2 = await page.locator('.product.blocked h3').allInnerTexts();
  check('everything fits the 2.5 m flat', blocked2.length === 0, blocked2.join(','));

  await page.locator('.product', { hasText: 'TÖRNBY' }).getByRole('button', { name: 'Buy' }).click();
  await page.waitForSelector('.bench-row');
  check('buying puts it on the bench', (await page.locator('.bench-row').innerText()).includes('TÖRNBY'));
  await shot('04-shop');

  await page.click('text=Build it');
  await page.waitForSelector('.step-card h2');
  check('build phase opens on step 1', (await page.locator('.step-no').innerText()).includes('Step 1'));
  check('the parts list is populated', await page.locator('.bom-row').count() === 6);
  check('the booklet drew something', await page.evaluate(() => {
    const c = document.querySelector('.booklet-canvas');
    return c.width > 0 && c.height > 0;
  }));
  await shot('05-build-bom');

  // tick the whole bill of materials
  const rows = await page.locator('.bom-row').count();
  for (let i = 0; i < rows; i++) await page.locator('.bom-row').nth(i).click();
  await page.waitForTimeout(150);
  check('BOM check completes step 1', (await page.locator('.step-no').innerText()).includes('Step 2'));

  // drive one dowel: hold on the marker, release inside the band
  await page.keyboard.press('4');                        // mallet
  check('the tool rack responds to the number keys', await page.locator('.tool.on .tname').innerText() === 'Rubber mallet');
  await shot('06-build-insert');

  // place a panel through the UI: step 3 is open in parallel with steps 2 and 3
  await page.locator('.step-list li.open', { hasText: 'left side panel' }).click();
  await page.locator('.bom-row', { hasText: 'Side panel' }).click();
  await page.waitForTimeout(120);
  check('picking a part offers a position', (await page.locator('.hud-hint').innerText()).includes('turn'));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const log = await page.locator('.toast').last().innerText();
  check('the panel goes in', /seated|wrong way/.test(log), log);
  check('the constraint readout lists it', (await page.locator('.rig-row').count()) >= 1);
  await shot('07-build-placed');

  await page.keyboard.press('e');                        // exploded view
  await page.waitForTimeout(200);
  await shot('08-exploded');
  await page.keyboard.press('e');

  // a half-finished build must survive a reload
  await page.reload({ waitUntil: 'networkidle' });
  const cont = await page.locator('.title-actions .btn.primary').innerText();
  check('the title offers to resume the build', /Continue building/i.test(cont), cont);
  await page.click('.title-actions .btn.primary');
  await page.waitForSelector('.step-card h2');
  check('the resumed build kept its progress', (await page.locator('.rig-row').count()) >= 1);
  check('the resumed build kept the ticked parts list', (await page.locator('.bom-row.checked').count()) === 6);
  await shot('09-resumed');

  await page.click('text=Leave');
  await page.waitForSelector('.catalog');
  check('leaving returns to the shop', await page.locator('.catalog').count() === 1);
} catch (e) {
  failures++;
  console.log(`  FAIL  walkthrough threw: ${e.message}`);
  await shot('99-failure');
}

check('no console errors', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close();
server.kill();
console.log(failures ? `\n${failures} FAILURE(S)\n` : '\nsmoke test passed\n');
process.exit(failures ? 1 : 0);
