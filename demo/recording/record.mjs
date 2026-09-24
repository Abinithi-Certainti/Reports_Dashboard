// Records a captioned walkthrough of the Tender Report demo (WebM).
import { chromium } from 'playwright';

const OUT = process.argv[2];
const W = 1440, H = 900;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUT, size: { width: W, height: H } } });

// A visible cursor and a caption bar, injected into every page load.
await context.addInitScript(() => {
  const install = () => {
    if (document.getElementById('__cap')) return;
    const cap = document.createElement('div');
    cap.id = '__cap';
    cap.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:99999;padding:12px 22px;border-radius:14px;' +
      'background:rgba(7,11,20,.88);border:1px solid rgba(56,189,248,.55);color:#f1f5f9;font:600 18px Inter Variable,system-ui,sans-serif;' +
      'box-shadow:0 0 30px rgba(56,189,248,.25);backdrop-filter:blur(8px);opacity:0;transition:opacity .35s ease;pointer-events:none;max-width:80vw;text-align:center';
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
const hideCaption = () => page.evaluate(() => { const c = document.getElementById('__cap'); if (c) c.style.opacity = '0'; });
async function glide(locator, opts = {}) {
  const box = await locator.boundingBox();
  const x = box.x + (opts.dx ?? box.width / 2), y = box.y + (opts.dy ?? box.height / 2);
  await page.mouse.move(x, y, { steps: 28 });
  return { x, y };
}
async function clickSmooth(locator) { await glide(locator); await wait(250); await locator.click(); }

// 1. Report list
await page.goto('http://localhost:4173/#/');
await page.waitForSelector('text=Tender Report');
await page.mouse.move(700, 400);
await caption('Report Engine demo  ·  one website that can show any report', 3000);
await caption('1 · Pick a report from the list');
await clickSmooth(page.getByText('Tender Report').first());

// 2. The report
await page.waitForSelector('text=All Locations - Detail');
await wait(1500);
await caption('2 · The Tender Report, rebuilt on the new PostgreSQL model  (sample data)', 3200);
await glide(page.getByText('Total tender amount'));
await caption('Live number cards with a daily trend line', 2400);
const spark = page.locator('canvas').first();
const sb = await spark.boundingBox();
await page.mouse.move(sb.x + sb.width * 0.25, sb.y + sb.height / 2, { steps: 20 });
await wait(500);
await page.mouse.move(sb.x + sb.width * 0.75, sb.y + sb.height / 2, { steps: 40 });
await caption('Hover any day to see its value', 2000);

// 3. Filters
await caption('3 · Filters: every card, table and chart follows them');
await clickSmooth(page.getByLabel('Plaza'));
await wait(600);
await clickSmooth(page.getByRole('option', { name: 'Market' }));
await page.keyboard.press('Escape');
await caption('Plaza = Market  →  the whole page updates', 3000);
await clickSmooth(page.getByLabel('Brand'));
await wait(600);
await clickSmooth(page.getByRole('option', { name: "Wendy's" }));
await page.keyboard.press('Escape');
await caption("…and Brand = Wendy's", 2600);

// 4. % to Total
await hideCaption();
await glide(page.getByText('Selected Locations - Summary'));
await clickSmooth(page.getByRole('button', { name: 'Reset filters' }));
await caption('4 · "% to Total": exactly as Power BI calculates it today', 3000);
await glide(page.getByRole('cell', { name: '% to Total' }).first().or(page.getByText('% to Total').first()));
await caption('Today these percentages do not add up to 100%', 2600);
await clickSmooth(page.getByRole('button', { name: 'Corrected (adds to 100%)' }));
await caption('One click shows the corrected version, so the lead can decide', 3200);
await clickSmooth(page.getByRole('button', { name: 'As in Power BI today' }));
await wait(800);

// 5. Bar chart
const chart = page.getByText('Tender amount by payment type');
await glide(chart);
const cb = await page.locator('canvas').nth(4).boundingBox();
if (cb) {
  await page.mouse.move(cb.x + cb.width * 0.3, cb.y + cb.height * 0.2, { steps: 25 });
  await wait(600);
  await page.mouse.move(cb.x + cb.width * 0.3, cb.y + cb.height * 0.45, { steps: 25 });
}
await caption('5 · Chart of the same summary, with hover details', 2800);

// 6. Detail grid
await hideCaption();
await page.mouse.wheel(0, 820);
await wait(1200);
await caption('6 · Detail by store, brand and payment type, one column per day', 3000);
await caption('Heat-map shading: brighter = bigger amount', 2600);
await clickSmooth(page.getByRole('button', { name: 'Collapse Bainsville' }));
await caption('Collapse and expand any store', 2400);
await clickSmooth(page.getByRole('button', { name: 'Expand Bainsville' }));
await wait(800);
const grid = page.getByText('All Locations - Detail').locator('xpath=ancestor::div[contains(@class,"MuiPaper")][1]').locator('div').filter({ has: page.locator('table') }).first();
await grid.evaluate((el) => el.scrollBy({ left: 700, behavior: 'smooth' }));
await caption('Scroll across the days; the store names stay in place', 2600);
await grid.evaluate((el) => el.scrollBy({ left: -700, behavior: 'smooth' }));

// 7. Wrap-up
await page.mouse.wheel(0, -1200);
await wait(1000);
await caption('Adding the next report = one settings file + one SQL file. No new code.', 3600);
await caption('Tender Report demo  ·  ready for review', 2600);
await hideCaption();
await wait(600);

const video = page.video();
await context.close();
console.log('video:', await video.path());
await browser.close();
