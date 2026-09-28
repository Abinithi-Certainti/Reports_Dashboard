// Made-up sample rows for the 8 built reports, used only when there is no DEV connection and no DEV export for a
// report (see staticApi.ts). Every page that uses them says so in an orange "Sample data - made up." banner.
//
// The rows have exactly the columns of each report's dataset.sql, so every visual, filter and formula runs as on real
// data. Names come from the repository (plaza renames in reports/*/dataset.sql, brands from the brand CASE, payment
// types from reports/tender-report). District directors are neutral labels, never people. The numbers are invented:
// plausible sizes and relationships (COGS below sales, budget near sales, small card fees) and nothing more.
//
// Generated at start-up, deterministically: the same day gives the same rows. Dates run over the last ~60 days up to
// today; reports with "last year" columns also get the same stretch one year earlier.
type DataRow = Record<string, string | number | null>;

// ---------- dates ----------
const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const utc = (day: string) => Date.parse(`${day}T00:00:00Z`);
const addDays = (day: string, n: number) => iso(utc(day) + n * DAY);
const dow = (day: string) => new Date(utc(day)).getUTCDay(); // 0 = Sunday
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekEnd = (day: string) => addDays(day, 6 - dow(day)); // weeks run Sunday to Saturday
const range = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};
function localToday(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

// Retail calendar, same rule as staticApi.ts: week 1 holds 1 January when that is a Sunday to Thursday, periods 4-4-5.
function retailYearStart(year: number): number {
  const jan1 = Date.UTC(year, 0, 1);
  const d = new Date(jan1).getUTCDay();
  return d <= 4 ? jan1 - d * DAY : jan1 + (7 - d) * DAY;
}
const PERIOD_ENDS = [4, 8, 13, 17, 21, 26, 30, 34, 39, 43, 47, 52];
function retailOf(day: string): { year: number; period: number; week: number } {
  const t = utc(day);
  let year = new Date(t).getUTCFullYear() + 1;
  while (retailYearStart(year) > t) year--;
  const week = Math.floor((t - retailYearStart(year)) / (7 * DAY)) + 1;
  return { year, period: PERIOD_ENDS.findIndex((end) => week <= end) + 1 || 12, week };
}

// ---------- deterministic noise: the same key always gives the same number in [0, 1) ----------
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const between = (key: string, lo: number, hi: number) => lo + hash(key) * (hi - lo);
const money = (n: number) => Math.round(n * 100) / 100;

// ---------- stores ----------
type Store = { plaza: string; brand: string; district: string; agm: string; storeId: number; key: string };
const PLAZAS: [plaza: string, district: string, agm: string, brands: string[]][] = [
  ['Newcastle', 'District A', 'Central', ['TIM HORTONS', 'BURGER KING', 'MARKET']],
  ['Port Hope', 'District A', 'Central', ['TIM HORTONS', 'BOOSTER JUICE', 'MARKET']],
  ['Trenton North', 'District A', 'East', ['TIM HORTONS', 'ANW', 'MARKET']],
  ['Trenton South', 'District A', 'East', ['TIM HORTONS', 'ANW']],
  ['Napanee', 'District B', 'East', ['TIM HORTONS', 'STARBUCKS', 'MARKET']],
  ['Odessa', 'District B', 'East', ['TIM HORTONS', 'WENDYS']],
  ['Mallorytown North', 'District B', 'East', ['TIM HORTONS', 'ANW', 'MARKET']],
  ['Ingleside', 'District B', 'East', ['TIM HORTONS', 'STARBUCKS']],
  ['Bainsville ON S', 'District B', 'East', ['TIM HORTONS', 'MARKET']],
  ['King City', 'District C', 'Central', ['TIM HORTONS', 'STARBUCKS', 'NEW YORK FRIES', 'MARKET']],
  ['Maple', 'District C', 'Central', ['TIM HORTONS', 'WENDYS', 'MARKET']],
  ['Cambridge North', 'District C', 'West', ['TIM HORTONS', 'STARBUCKS', 'MARKET']],
  ['Woodstock', 'District C', 'West', ['TIM HORTONS', 'WENDYS']],
  ['Dutton', 'District C', 'West', ['TIM HORTONS', 'ANW', 'MARKET']],
  ['Ingersoll', 'District C', 'West', ['TIM HORTONS', 'BURGER KING']],
];
const STORES: Store[] = PLAZAS.flatMap(([plaza, district, agm, brands], p) =>
  brands.map((brand, b) => ({ plaza, brand, district, agm, storeId: 1000 + p * 10 + b, key: `${plaza}|${brand}` })));

/** Typical net sales per day, average check and gross margin (sales - COGS) by brand. */
const BRAND: Record<string, { daily: number; check: number; gp: number; splh: number }> = {
  'TIM HORTONS': { daily: 9500, check: 7.2, gp: 0.68, splh: 72 },
  STARBUCKS: { daily: 4200, check: 8.9, gp: 0.7, splh: 68 },
  WENDYS: { daily: 5200, check: 12.4, gp: 0.64, splh: 78 },
  'BURGER KING': { daily: 4600, check: 12.9, gp: 0.63, splh: 76 },
  'NEW YORK FRIES': { daily: 1900, check: 10.5, gp: 0.66, splh: 64 },
  ANW: { daily: 3800, check: 12.1, gp: 0.64, splh: 74 },
  'BOOSTER JUICE': { daily: 1300, check: 9.4, gp: 0.69, splh: 58 },
  MARKET: { daily: 6400, check: 14.8, gp: 0.33, splh: 110 },
};
const WEEKDAY_FACTOR = [1.12, 0.92, 0.88, 0.93, 1.0, 1.2, 1.18];

/** Net sales for one store and day; last year's days are a little lower. */
function netSales(s: Store, day: string, lastYear = false): number {
  const base = BRAND[s.brand].daily * between(`size|${s.key}`, 0.7, 1.35);
  const v = base * WEEKDAY_FACTOR[dow(day)] * between(`day|${s.key}|${day}`, 0.88, 1.12) * (lastYear ? between(`py|${s.key}`, 0.9, 1.0) : 1);
  return money(v);
}
const transactionsFor = (s: Store, sales: number, day: string) =>
  Math.max(1, Math.round(sales / (BRAND[s.brand].check * between(`chk|${s.key}|${day}`, 0.94, 1.06))));
const labourFor = (s: Store, sales: number, day: string) =>
  Math.round((sales / (BRAND[s.brand].splh * between(`splh|${s.key}|${day}`, 0.9, 1.1))) * 4) / 4;
/** Market only: card fees and beer deposits, small amounts taken out of net sales. */
const cardFee = (s: Store, day: string) => (s.brand === 'MARKET' ? money(between(`fee|${s.key}|${day}`, 8, 35)) : 0);
const deposit = (s: Store, day: string) => (s.brand === 'MARKET' ? money(between(`dep|${s.key}|${day}`, 5, 25)) : 0);

// ---------- the reports ----------
type Ctx = { today: string; from: string; lastSaturday: string; pyFrom: string; pyTo: string };

function tender(c: Ctx): DataRow[] {
  const TYPES: [name: string, seq: number, share: number, only?: string][] = [
    ['Cash', 1, 0.17], ['US Cash', 2, 0.01], ['Debit Card', 3, 0.3], ['Visa', 4, 0.22], ['Mastercard', 5, 0.15],
    ['AMEX', 6, 0.04], ['Discover', 7, 0.01], ['Tim Card', 8, 0.06, 'TIM HORTONS'], ['Starbucks Card', 9, 0.07, 'STARBUCKS'],
    ['Gift Card', 10, 0.02], ['On Account', 12, 0.005],
  ];
  const rows: DataRow[] = [];
  for (const day of range(c.from, c.today)) {
    for (const s of STORES) {
      const total = netSales(s, day) * 1.13; // tenders include tax
      for (const [name, sequence, share, only] of TYPES) {
        if (only && only !== s.brand) continue;
        if (share < 0.02 && hash(`t|${s.key}|${day}|${name}`) < 0.6) continue; // rare tenders on some days only
        const amount = money(total * share * between(`ts|${s.key}|${day}|${name}`, 0.8, 1.2));
        rows.push({ end_day: day, plaza: s.plaza, brand: s.brand, district_director: s.district, payment_type: name, sequence, tender_amount: amount, paidout_amount: 0 });
      }
      if (hash(`po|${s.key}|${day}`) < 0.55) {
        rows.push({ end_day: day, plaza: s.plaza, brand: s.brand, district_director: s.district, payment_type: 'Cash', sequence: 1, tender_amount: 0, paidout_amount: money(between(`poa|${s.key}|${day}`, 15, 160)) });
      }
    }
  }
  return rows;
}

const saturdays = (from: string, to: string) => range(from, to).filter((d) => dow(d) === 6);
const weekSales = (s: Store, saturday: string) => range(addDays(saturday, -6), saturday).reduce((a, d) => a + netSales(s, d), 0);

function waste(c: Ctx): DataRow[] {
  const ITEMS: [num: number, name: string, category: string, sub: string, price: number][] = [
    [10112, 'Coffee Beans 2lb', 'Beverage', 'Coffee', 38.5], [10240, 'Milk 4L', 'Dairy', 'Milk', 6.2],
    [10318, 'Cream 1L', 'Dairy', 'Cream', 4.9], [20455, 'Bagels 6pk', 'Bakery', 'Bread', 3.1],
    [20512, 'Donut Mix', 'Bakery', 'Donuts', 21.4], [30107, 'Chicken Patty', 'Food', 'Protein', 1.4],
    [30220, 'Lettuce Case', 'Food', 'Produce', 28.0], [40031, 'Hot Cups 12oz', 'Packaging', 'Cups', 0.09],
  ];
  const rows: DataRow[] = [];
  for (const sat of saturdays(c.from, c.lastSaturday)) {
    for (const s of STORES) {
      const weekCogs = weekSales(s, sat) * (1 - BRAND[s.brand].gp);
      for (const [num, name, category, sub, price] of ITEMS) {
        const k = `w|${s.key}|${sat}|${num}`;
        const cogs = money((weekCogs / ITEMS.length) * between(`${k}|c`, 0.5, 1.5));
        const begin = money(cogs * between(`${k}|b`, 0.4, 0.9));
        const transfer = hash(`${k}|t`) < 0.2 ? money(cogs * between(`${k}|tv`, 0.01, 0.05)) : 0;
        const varAdj = money(cogs * between(`${k}|v`, -0.02, 0.02));
        const end = money(begin * between(`${k}|e`, 0.85, 1.15));
        const purchase = money(cogs + end + transfer - begin - varAdj); // so that COGS = begin + purchase + adj - end - transfers
        const theo = money(cogs * between(`${k}|th`, 0.9, 0.97));
        const wasteValue = money(cogs * between(`${k}|wv`, 0.01, 0.04));
        const wasteAdj = money(cogs * between(`${k}|wa`, 0, 0.01));
        rows.push({
          period: sat, plaza: s.plaza, brand: s.brand, district_director: s.district, category, sub_category: sub,
          item_description: `${num}-${name}`, unit_price: price, begin_value: begin, purchase_value: purchase, var_adj_value: varAdj,
          end_value: end, transfer_out_value: transfer, cogs, theo_cost: theo, waste_value: wasteValue, waste_adj_value: wasteAdj,
        });
      }
    }
  }
  return rows;
}

function marketCategory(c: Ctx): DataRow[] {
  const markets = STORES.filter((s) => s.brand === 'MARKET');
  const CATEGORIES: [category: string, sub: string, share: number][] = [
    ['Grocery', 'Snacks', 0.22], ['Grocery', 'Candy', 0.14], ['Beverage', 'Soft Drinks', 0.24],
    ['Beverage', 'Water', 0.1], ['Hot Food', 'Sandwiches', 0.18], ['Beer', 'Domestic', 0.12],
  ];
  const DEPARTMENTS: [name: string, share: number][] = [
    ['Snacks', 0.2], ['Candy', 0.13], ['Beverages', 0.33], ['Hot Food', 0.2], ['Beer', 0.14],
  ];
  const rows: DataRow[] = [];
  const base = (s: Store) => ({ plaza: s.plaza, district_director: s.district });
  const zeroStock = { begin_value: 0, purchase_value: 0, end_value: 0, waste_value: 0, cogs: 0 };
  for (const day of range(c.from, c.lastSaturday)) {
    for (const s of markets) {
      const sales = netSales(s, day);
      for (const [dept, share] of DEPARTMENTS) {
        const v = money(sales * share * between(`m|${s.key}|${day}|${dept}`, 0.85, 1.15));
        rows.push({ day, ...base(s), category: null, sub_category: null, department: dept, ...zeroStock, sales: v, sales_units: Math.round(v / between(`mu|${dept}`, 2.5, 6)) });
      }
      if (dow(day) !== 6 || addDays(day, -6) < c.from) continue; // only whole weeks, so GP % is not skewed
      // stock rows, dated on the week-ending Saturday
      const weekCogs = weekSales(s, day) * (1 - BRAND.MARKET.gp);
      for (const [category, sub, share] of CATEGORIES) {
        const k = `ms|${s.key}|${day}|${sub}`;
        const cogs = money(weekCogs * share * between(`${k}|c`, 0.85, 1.15));
        const begin = money(cogs * between(`${k}|b`, 1.2, 2.2));
        const end = money(begin * between(`${k}|e`, 0.9, 1.1));
        rows.push({
          day, ...base(s), category, sub_category: sub, department: null, begin_value: begin, purchase_value: money(cogs + end - begin),
          end_value: end, waste_value: money(cogs * between(`${k}|w`, 0.01, 0.05)), cogs, sales: 0, sales_units: 0,
        });
      }
    }
  }
  return rows;
}

function salesMarginBudget(c: Ctx): DataRow[] {
  const rows: DataRow[] = [];
  const zero = { net_sales: 0, card_fees: 0, deposits: 0, sales: 0, transactions: 0, cogs: 0, budget_sales: 0, budget_gp: 0 };
  for (const day of range(c.from, c.today)) {
    for (const s of STORES) {
      const id = { day, plaza: s.plaza, brand: s.brand, district_director: s.district };
      const planned = netSales(s, day) * between(`bud|${s.key}|${day}`, 0.93, 1.07);
      const budget = money(planned);
      const budgetGp = money(budget * (BRAND[s.brand].gp + between(`bgp|${s.key}`, -0.02, 0.02)));
      // Budget runs ahead of sales, as on DEV: sales stop at the last full week, the budget goes on to today.
      if (day > c.lastSaturday) {
        rows.push({ ...id, ...zero, budget_sales: budget, budget_gp: budgetGp });
        continue;
      }
      const net = netSales(s, day), fee = cardFee(s, day), dep = deposit(s, day);
      rows.push({ ...id, ...zero, net_sales: net, card_fees: fee, deposits: dep, sales: money(net - fee - dep), transactions: transactionsFor(s, net, day), budget_sales: budget, budget_gp: budgetGp });
      if (dow(day) === 6 && addDays(day, -6) >= c.from) {
        // weekly COGS for whole weeks, dated on the week-ending Saturday
        const cogs = money(weekSales(s, day) * (1 - BRAND[s.brand].gp) * between(`cogs|${s.key}|${day}`, 0.95, 1.06));
        rows.push({ ...id, ...zero, cogs });
      }
    }
  }
  return rows;
}

/** Daily sales, transactions and labour for this stretch and the same stretch one year earlier. */
function dailySales(c: Ctx, extra: (s: Store, day: string, lastYear: boolean, sales: number) => DataRow, withDeposits: boolean): DataRow[] {
  const rows: DataRow[] = [];
  const days: [string, boolean][] = [...range(c.pyFrom, c.pyTo).map((d) => [d, true] as [string, boolean]), ...range(c.from, c.today).map((d) => [d, false] as [string, boolean])];
  for (const [day, lastYear] of days) {
    for (const s of STORES) {
      const net = netSales(s, day, lastYear), fee = cardFee(s, day), dep = withDeposits ? deposit(s, day) : 0;
      const sales = money(net - fee - dep);
      rows.push({
        day, weekday: WEEKDAYS[dow(day)], weekday_no: dow(day) + 1, week_end: weekEnd(day),
        plaza: s.plaza, brand: s.brand, district_director: s.district,
        net_sales: net, card_fees: fee, ...(withDeposits ? { deposits: dep } : {}), sales,
        transactions: transactionsFor(s, net, day), labour_hours: labourFor(s, sales, day),
        ...extra(s, day, lastYear, sales),
      });
    }
  }
  return rows;
}

const salesReport1 = (c: Ctx) => dailySales(c, (s) => ({ agm: s.agm }), true);
const fieldTeam = (c: Ctx) => dailySales(c, () => ({ agm: null }), false); // AGM list not confirmed yet (as dataset.sql)
const budget2026 = (c: Ctx) => dailySales(c, (s, day, lastYear, sales) => {
  const r = retailOf(day);
  const k = `b26|${s.key}|${day}`;
  const budget = lastYear ? 0 : money(sales * between(`${k}|s`, 0.93, 1.07));
  return {
    agm: s.agm, retail_year: r.year, retail_period: r.period, retail_week: r.week,
    budget_sales: budget,
    budget_transactions: lastYear ? 0 : Math.round(budget / BRAND[s.brand].check),
    budget_labour_hours: lastYear ? 0 : Math.round((budget / (BRAND[s.brand].splh * between(`${k}|l`, 0.95, 1.05))) * 4) / 4,
  };
}, true);

function financial(c: Ctx): DataRow[] {
  const rows: DataRow[] = [];
  const none = { donation_item: null, lottery_category: null, lottery_type: null, hst: 0, gift_card: 0, donations: 0, lottery_amount: 0 };
  for (const day of range(c.from, c.today)) {
    for (const s of STORES) {
      const id = { day, plaza: s.plaza, brand: s.brand, store_id: s.storeId };
      const sales = netSales(s, day);
      rows.push({ ...id, ...none, hst: money(sales * 0.13 * between(`hst|${s.key}|${day}`, 0.97, 1.0)) });
      if (s.brand !== 'MARKET' && hash(`gc|${s.key}|${day}`) < 0.7) rows.push({ ...id, ...none, gift_card: money(between(`gcv|${s.key}|${day}`, 20, 260)) });
      for (const item of ['Camp Day Bracelet', 'Donation Box']) {
        if (hash(`dn|${s.key}|${day}|${item}`) < 0.5) rows.push({ ...id, ...none, donation_item: item, donations: money(between(`dnv|${s.key}|${day}|${item}`, 5, 90)) });
      }
      if (s.brand === 'MARKET') {
        const tickets = money(between(`lt|${s.key}|${day}`, 300, 1100));
        const open = money(between(`lo|${s.key}|${day}`, 150, 600));
        rows.push({ ...id, ...none, lottery_category: 'Sales', lottery_type: 'Instant Tickets', lottery_amount: tickets });
        rows.push({ ...id, ...none, lottery_category: 'Sales', lottery_type: 'Open lottery', lottery_amount: open });
        rows.push({ ...id, ...none, lottery_category: 'Redemptions', lottery_type: 'Instant Tickets', lottery_amount: -money(tickets * between(`lr|${s.key}|${day}`, 0.4, 0.7)) });
      }
      // every cash paid out counts as a redemption, as in the old report
      if (hash(`fpo|${s.key}|${day}`) < 0.55) rows.push({ ...id, ...none, lottery_category: 'Redemptions', lottery_type: 'Redemptions', lottery_amount: -money(between(`poa|${s.key}|${day}`, 15, 160)) });
    }
  }
  return rows;
}

const GENERATORS: Record<string, (c: Ctx) => DataRow[]> = {
  'tender-report': tender,
  'waste-report': waste,
  'market-category': marketCategory,
  'sales-margin-budget': salesMarginBudget,
  'sales-report-1': salesReport1,
  'sales-budget-2026': budget2026,
  'sales-field-team': fieldTeam,
  'financial-reports': financial,
};

const DAYS_BACK = 60;

/** Made-up rows for a built report, or undefined for a report this file does not know. */
export function sampleRows(reportId: string, today: string = localToday()): DataRow[] | undefined {
  const gen = GENERATORS[reportId];
  if (!gen) return undefined;
  const from = addDays(today, -(DAYS_BACK - 1));
  const lastSaturday = addDays(today, -((dow(today) + 1) % 7));
  // One year earlier: wide enough for both "last year" rules (same retail weekday, 364 or 371 days back, and the
  // same calendar date, 365 or 366 days back).
  return gen({ today, from, lastSaturday, pyFrom: addDays(from, -372), pyTo: addDays(today, -364) });
}
