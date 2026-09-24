// Captioned walkthrough v2: themes, KPIs, filters, mapping studio, live import. Logs sound cues to sfx.json.
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const OUT = process.argv[2];
const W = 1440, H = 900;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUT, size: { width: W, height: H } } });
const t0 = Date.now();
const cues = [];
const sfx = (name, delay = 0) => cues.push({ t: (Date.now() - t0 + delay) / 1000, name });

await context.addInitScript(() => {
  try { localStorage.setItem('re.theme', 'neon'); localStorage.setItem('re.sound', 'on'); } catch {}
  const install = () => {
    if (document.getElementById('__cap')) return;
    const cap = document.createElement('div');
    cap.id = '__cap';
    cap.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:99999;padding:12px 22px;border-radius:14px;' +
      'background:rgba(7,11,20,.9);border:1px solid rgba(56,189,248,.6);color:#f1f5f9;font:600 18px "Inter Variable",system-ui,sans-serif;' +
      'box-shadow:0 0 30px rgba(56,189,248,.25);opacity:0;transition:opacity .35s ease;pointer-events:none;max-width:80vw;text-align:center';
    document.body.appendChild(cap);
    const cur = document.createElement('div');
    cur.id = '__cur';
    cur.style.cssText = 'position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;z-index:100000;pointer-events:none;' +
      'background:rgba(56,189,248,.35);border:2px solid #38bdf8;box-shadow:0 0 14px #38bdf8;transition:transform .12s ease';
    document.body.appendChild(cur);
    addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => { cur.style.transform = 'scale(.7)'; }, true);
    addEventListener('mouseup', () => { cur.style.transform = 'scale(1)'; }, true);
  };
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', install) : install();
});

const page = await context.newPage();
const wait = (ms) => page.waitForTimeout(ms);
const caption = async (text, ms = 2600) => {
  await page.evaluate((t) => { const c = document.getElementById('__cap'); if (c) { c.textContent = t; c.style.opacity = '1'; } }, text);
  await wait(ms);
};
const hide = () => page.evaluate(() => { const c = document.getElementById('__cap'); if (c) c.style.opacity = '0'; });
async function glide(loc, dx, dy) {
  const b = await loc.boundingBox();
  await page.mouse.move(b.x + (dx ?? b.width / 2), b.y + (dy ?? b.height / 2), { steps: 26 });
}
async function click(loc, sound = 'click') { await glide(loc); await wait(200); sfx(sound); await loc.click(); }

// 0. Overview
await page.goto('http://localhost:4173/#/');
await page.waitForSelector('text=Reports live');
await page.mouse.move(720, 450);
await wait(900);
await caption('Report Engine  ·  one website for every migrated report', 3000);
await glide(page.getByText('Code changes per new report'));
await caption('Every report runs from its own settings file - no new code per report', 3000);

// 1. Open the Tender Report
await click(page.getByRole('link', { name: /Tender Report Tenders by payment type/ }));
await page.waitForSelector('text=All Locations - Detail');
await wait(1600);
await caption('1 · Tender Report, rebuilt on the new PostgreSQL model  (sample data)', 3000);
await glide(page.getByText('Total tender amount'));
await caption('Number cards: animated value, daily trend, and change vs the previous period', 3200);
await glide(page.getByText('Paid-outs', { exact: true }).first());
await caption('Paid-outs going up is shown in red - each card knows which direction is good', 3000);
const line = page.getByText('Daily tender amount');
const lb = await line.boundingBox();
await page.mouse.move(lb.x + 200, lb.y + 120, { steps: 20 });
await page.mouse.move(lb.x + 900, lb.y + 130, { steps: 60 });
await caption('Hover the trend for any day', 2200);

// 2. Filters
await caption('2 · Filters - every card, chart and table follows them', 2200);
await click(page.getByLabel('Plaza'));
await wait(500);
await click(page.getByRole('option', { name: 'Market' }), 'filter');
await page.keyboard.press('Escape');
await caption('Plaza = Market', 2400);

// 3. Themes
await hide();
await caption('3 · Switch themes in one click', 1600);
await click(page.getByRole('button', { name: 'Light theme' }), 'whoosh');
await caption('Light', 2400);
await click(page.getByRole('button', { name: 'Midnight theme' }), 'whoosh');
await caption('Midnight', 2400);
await click(page.getByRole('button', { name: 'Neon theme' }), 'whoosh');
await caption('Neon  ·  your choice is remembered, and sounds can be switched off', 2800);
await click(page.getByRole('button', { name: 'Reset filters' }), 'whoosh');
await wait(800);

// 4. % to Total
await page.mouse.wheel(0, 560);
await wait(900);
await caption('4 · "% to Total" exactly as Power BI shows it today (does not add to 100%)', 3000);
await click(page.getByRole('button', { name: 'Corrected (adds to 100%)' }), 'toggle');
await caption('One click shows the corrected version - so the lead can decide', 3000);
await click(page.getByRole('button', { name: 'As in Power BI today' }), 'toggle');

// 5. Detail grid
await hide();
await page.mouse.wheel(0, 700);
await wait(1100);
await caption('5 · Detail by store, brand and payment type - heat map, one column per day', 3000);
await click(page.getByRole('button', { name: 'Collapse Bainsville' }));
await wait(900);
await click(page.getByRole('button', { name: 'Expand Bainsville' }));
await wait(700);

// 6. Mapping Studio
await page.mouse.wheel(0, -3000);
await wait(500);
await click(page.getByRole('link', { name: 'Mapping Studio' }));
await page.waitForSelector('text=Hidden business rules');
await wait(1200);
await caption('6 · Mapping Studio - how every old field maps to the new database', 3200);
await glide(page.getByText('Auto-match').first());
await caption('Old names are converted by rule, then checked against the new database', 3200);
await page.mouse.wheel(0, 380);
await wait(900);
await caption('18 of 19 fields matched automatically; 1 is waiting for a person - never guessed', 3400);
await page.mouse.wheel(0, 1500);
await wait(1000);
await caption('Hidden business rules and problems found in the old report are kept on record', 3200);

// 7. Import a report
await page.mouse.wheel(0, -3000);
await click(page.getByRole('link', { name: 'Import report' }));
await page.waitForSelector('text=Drop report.yaml');
await wait(900);
await caption('7 · Add a new report by uploading two files - no code change, no redeploy', 3200);
await click(page.getByRole('button', { name: /Use the example/ }), 'filter');
await caption('A settings file and its SQL for a brand-new "Paid-outs Report"', 3000);
await click(page.getByRole('button', { name: 'Check it' }));
for (let i = 0; i < 4; i++) sfx('click', 380 * (i + 1));
await caption('The engine checks it safely: valid settings, read-only SQL, and a dry run on the database', 3400);
await click(page.getByRole('button', { name: 'Publish' }));
for (let i = 0; i < 5; i++) sfx('click', 380 * (i + 1));
sfx('success', 380 * 5 + 80);
await wait(2600);
await caption('Published - it is live now', 2000);
await click(page.getByRole('link', { name: 'Open report' }));
await page.waitForSelector('text=By store');
await wait(1800);
await caption('A new report, drawn by the same engine - zero lines of code written for it', 3600);
await page.mouse.wheel(0, 500);
await wait(1500);
await page.mouse.wheel(0, -500);
await caption('Report Engine demo  ·  ready for review', 2600);
await hide();
await wait(700);

const video = page.video();
await context.close();
writeFileSync(`${OUT}/sfx.json`, JSON.stringify(cues));
console.log('video:', await video.path(), 'cues:', cues.length);
await browser.close();
