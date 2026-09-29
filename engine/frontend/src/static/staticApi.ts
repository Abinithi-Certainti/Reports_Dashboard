// The in-browser engine: the same API as the Java engine, answered inside the browser, so the page works with no
// server. api.ts uses it when the backend or its database cannot be reached (and always in `npm run build:static`).
// The rules match the backend:
//   filters/exclude/dates  -> engine/backend/.../query/SqlBuilder.java
//   % to Total modes       -> engine/backend/.../query/Calculations.java
//   import checks          -> engine/backend/.../spec/ReportRegistry.java + web/ImportController.java
// Only the database dry run differs: there is no database here, so an upload can only use a bundled dataset.
import { parse as parseYaml } from 'yaml';
import type { DataSource, ImportCheck, ImportResult, Mapping, QueryRequest, ReportSummary, RetailWeek, Row, Spec } from '../api';
import { sampleRows } from './sampleData';
import tenderYaml from '../../../../reports/tender-report/report.yaml?raw';
import tenderSql from '../../../../reports/tender-report/dataset.sql?raw';
import tenderMapping from '../../../../reports/tender-report/mapping.json';
import wasteYaml from '../../../../reports/waste-report/report.yaml?raw';
import wasteSql from '../../../../reports/waste-report/dataset.sql?raw';
import marketYaml from '../../../../reports/market-category/report.yaml?raw';
import marketSql from '../../../../reports/market-category/dataset.sql?raw';
import salesMarginYaml from '../../../../reports/sales-margin-budget/report.yaml?raw';
import salesMarginSql from '../../../../reports/sales-margin-budget/dataset.sql?raw';
import salesReport1Yaml from '../../../../reports/sales-report-1/report.yaml?raw';
import salesReport1Sql from '../../../../reports/sales-report-1/dataset.sql?raw';
import budget2026Yaml from '../../../../reports/sales-budget-2026/report.yaml?raw';
import budget2026Sql from '../../../../reports/sales-budget-2026/dataset.sql?raw';
import fieldTeamYaml from '../../../../reports/sales-field-team/report.yaml?raw';
import fieldTeamSql from '../../../../reports/sales-field-team/dataset.sql?raw';
import financialYaml from '../../../../reports/financial-reports/report.yaml?raw';
import financialSql from '../../../../reports/financial-reports/dataset.sql?raw';

// Rows per report: the DEV export in demo/private-data/<report id>.json when there is one (git-ignored - the repository
// is public; written by tools/private_to_json.py), else made-up sample rows from sampleData.ts. The glob is empty in a
// fresh clone, so every report then runs on sample rows, and its page says so.
// The file holds either plain rows, or (tools/private_to_json.py, smaller) column names, one list of distinct text
// values per text column, and each row as a list where a text value is its position in that column's list.
type PackedFile = { columns: string[]; dicts: Record<string, string[]>; data: (string | number | null)[][] };
type RawFile = { exported_on: string; source: string; row_cap_hit: boolean; rows?: DataRow[] } & Partial<PackedFile>;
type PrivateFile = { exported_on: string; source: string; row_cap_hit: boolean; rows: DataRow[] };
const privateData = import.meta.glob('../../../../demo/private-data/*.json', { eager: true, import: 'default' }) as Record<string, RawFile>;
const unpacked = new Map<string, PrivateFile>();
function privateFile(id: string): PrivateFile | undefined {
  if (unpacked.has(id)) return unpacked.get(id);
  const raw = Object.entries(privateData).find(([path]) => path.endsWith(`/${id}.json`))?.[1];
  if (!raw) return undefined;
  let rows = raw.rows;
  if (!rows && raw.columns && raw.data) {
    const { columns, dicts = {}, data } = raw;
    rows = data.map((r) => {
      const row: DataRow = {};
      columns.forEach((c, i) => { const v = r[i]; row[c] = dicts[c] && typeof v === 'number' ? dicts[c][v] : v; });
      return row;
    });
  }
  const file = { exported_on: raw.exported_on, source: raw.source, row_cap_hit: raw.row_cap_hit, rows: rows ?? [] };
  unpacked.set(id, file);
  return file;
}

type DataRow = Record<string, string | number | null>;
type FullDimension = { label: string; column: string; type?: string | null; sort_by?: string | null };
type FullMeasure = { label: string; sql?: string; format?: string | null; window?: string | null; of?: string | null };
type FullSpec = Omit<Spec, 'dimensions' | 'measures' | 'sampleDataNotice'> & {
  dataset?: string;
  calendar?: string | null;
  dimensions: Record<string, FullDimension>;
  measures: Record<string, FullMeasure>;
};
type Report = { spec: FullSpec; rows: DataRow[]; source: DataSource; builtIn: boolean; yaml: string; sql: string; eval: Record<string, Agg> };
type Agg = (rows: DataRow[]) => number | null;

/** Banner on every report: where its rows come from - a DEV export (and whether it was cut off), or made-up rows. */
function dataNotice(id: string, source: DataSource): { title: string; text: string } {
  const f = privateFile(id);
  if (source === 'export' && f) {
    const cut = f.row_cap_hit
      ? ' The export stopped at its row limit, so some days or plazas are missing and totals are too low.'
      : '';
    return { title: 'DEV export.', text: `${f.source}, exported ${f.exported_on}. Not yet compared with Power BI.${cut}` };
  }
  return {
    title: 'Sample data - made up.',
    text: 'No DEV connection and no DEV export for this report, so these rows are generated. The layout and formulas are real; the numbers are not.',
  };
}
const STORE_KEY = 're.imported';

class BadRequest extends Error {}

// ---------- datasets: the SQL text decides which bundled rows an uploaded report may use ----------
const normalise = (sql: string) => cleanSql(sql).replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const BUILT_IN: [string, string, string][] = [
  ['tender-report', tenderYaml, tenderSql],
  ['waste-report', wasteYaml, wasteSql],
  ['market-category', marketYaml, marketSql],
  ['sales-margin-budget', salesMarginYaml, salesMarginSql],
  ['sales-report-1', salesReport1Yaml, salesReport1Sql],
  ['sales-budget-2026', budget2026Yaml, budget2026Sql],
  ['sales-field-team', fieldTeamYaml, fieldTeamSql],
  ['financial-reports', financialYaml, financialSql],
];
/** A built report's rows and where they come from: its DEV export if loaded, else made-up sample rows. */
function builtInRows(id: string): { rows: DataRow[]; source: DataSource } | undefined {
  const f = privateFile(id);
  if (f) return { rows: f.rows, source: 'export' };
  const rows = sampleRows(id);
  return rows && { rows, source: 'sample' };
}
const DATASETS: { sql: string; rows: DataRow[]; source: DataSource }[] = BUILT_IN.flatMap(([id, , sql]) => {
  const d = builtInRows(id);
  return d ? [{ sql: normalise(sql), ...d }] : [];
});

// ---------- measures: sum(x), count(*), min/max/avg(x), numbers, + - * / and brackets ----------
function compileMeasure(expr: string, columns: Set<string>): Agg {
  const tokens = expr.match(/\s*([A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|\*|[-+/(),])/g)?.map((s) => s.trim()) ?? [];
  if (tokens.join('').replace(/\s/g, '') !== expr.replace(/\s/g, '')) throw new BadRequest(`cannot read measure "${expr}"`);
  let i = 0;
  const peek = () => tokens[i];
  const take = (t?: string) => {
    const v = tokens[i++];
    if (t && v?.toLowerCase() !== t) throw new BadRequest(`expected "${t}" in "${expr}"`);
    return v;
  };
  type Node = (rows: DataRow[]) => number | null;
  const num = (r: DataRow, c: string) => (r[c] === null || r[c] === undefined ? null : Number(r[c]));
  function primary(): Node {
    const t = take();
    if (t === undefined) throw new BadRequest(`measure "${expr}" ends too early`);
    if (t === '(') {
      const n = sum();
      take(')');
      return n;
    }
    if (t === '-') {
      const n = primary();
      return (rows) => { const v = n(rows); return v === null ? null : -v; };
    }
    if (/^\d/.test(t)) return () => Number(t);
    const fn = t.toLowerCase();
    if (fn === 'nullif') {
      // nullif(a, b): NULL when a equals b - used to avoid dividing by zero, as in SQL.
      take('(');
      const a = sum();
      take(',');
      const b = sum();
      take(')');
      return (rows) => { const x = a(rows), y = b(rows); return x !== null && y !== null && x === y ? null : x; };
    }
    if (!['sum', 'count', 'min', 'max', 'avg'].includes(fn)) {
      throw new BadRequest(`this online demo supports sum, count, min, max, avg and nullif; found "${t}"`);
    }
    take('(');
    const arg = take();
    take(')');
    if (arg === '*') {
      if (fn !== 'count') throw new BadRequest(`${fn}(*) is not allowed`);
      return (rows) => rows.length;
    }
    if (!columns.has(arg)) throw new BadRequest(`column "${arg}" does not exist`);
    return (rows) => {
      const vals = rows.map((r) => num(r, arg)).filter((v): v is number => v !== null);
      if (fn === 'count') return vals.length;
      if (vals.length === 0) return null; // like SQL: sum of no rows is NULL
      if (fn === 'sum') return round(vals.reduce((a, b) => a + b, 0));
      if (fn === 'min') return Math.min(...vals);
      if (fn === 'max') return Math.max(...vals);
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
  }
  function product(): Node {
    let left = primary();
    while (peek() === '*' || peek() === '/') {
      const op = take();
      const l = left, r = primary();
      left = (rows) => {
        const a = l(rows), b = r(rows);
        if (a === null || b === null) return null;
        return op === '*' ? a * b : b === 0 ? null : a / b;
      };
    }
    return left;
  }
  function sum(): Node {
    let left = product();
    while (peek() === '+' || peek() === '-') {
      const op = take();
      const l = left, r = product();
      left = (rows) => {
        const a = l(rows), b = r(rows);
        if (a === null || b === null) return null; // SQL: NULL - x is NULL
        // Only clears floating-point noise: rounding to cents here would break ratios such as GP % - Bud %.
        return Math.round((op === '+' ? a + b : a - b) * 1e9) / 1e9;
      };
    }
    return left;
  }
  const node = sum();
  if (i !== tokens.length) throw new BadRequest(`unexpected "${tokens[i]}" in measure "${expr}"`);
  return node;
}
const round = (n: number) => Math.round(n * 100) / 100;

// ---------- validation (same rules and messages as ReportRegistry.validate) ----------
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const REPORT_ID = /^[a-z0-9][a-z0-9-]{1,60}$/;
const VISUAL_TYPES: string[] = ['kpi', 'line', 'table', 'bar', 'matrix', 'donut', 'leaderboard', 'split', 'waterfall', 'stack', 'heatmap', 'bullet'];
const KPI_ICONS: string[] = ['total', 'cash', 'card', 'paidout', 'count', 'store', 'trend'];
const FILTER_TYPES: string[] = ['multi_select', 'date_range', 'retail_week'];
const WINDOWS: string[] = ['wtd', 'ptd', 'mtd', 'ytd', 'py', 'yoy', 'yoy_pct', 'py_fin', 'yoy_fin', 'yoy_fin_pct'];
const STARTS_WITH_SELECT = /^\s*(--[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*(select|with)\b/i;

function cleanSql(sql: string) {
  const s = (sql ?? '').trim();
  return s.endsWith(';') ? s.slice(0, -1).trim() : s;
}

function validate(spec: FullSpec, sql: string) {
  const require = (ok: unknown, message: string) => {
    if (!ok) throw new BadRequest(message);
  };
  require(spec && typeof spec === 'object', 'report.yaml is empty');
  require(spec.id && REPORT_ID.test(spec.id), 'id must be lower-case letters, digits and dashes, e.g. paidout-report');
  require(spec.title && String(spec.title).trim(), 'title is required');
  require(spec.dimensions && Object.keys(spec.dimensions).length, 'at least one dimension is required');
  require(spec.measures && Object.keys(spec.measures).length, 'at least one measure is required');
  require(sql.length, 'dataset SQL is empty');
  require(!sql.includes(';'), 'dataset SQL must be a single statement (no semicolons)');
  require(STARTS_WITH_SELECT.test(sql), 'dataset SQL must be a SELECT (or WITH ... SELECT)');
  const lower = sql.toLowerCase();
  for (const word of ['insert ', 'update ', 'delete ', 'drop ', 'alter ', 'truncate ', 'grant ', 'create ']) {
    require(!lower.includes(word), `dataset SQL must only read data (found '${word.trim()}')`);
  }
  for (const [id, d] of Object.entries(spec.dimensions)) {
    require(IDENTIFIER.test(id) && d?.column && IDENTIFIER.test(d.column), `bad dimension name ${id}`);
    require(!d.sort_by || IDENTIFIER.test(d.sort_by), `bad sort_by on ${id}`);
  }
  if (spec.calendar != null) require(spec.calendar === 'retail', `calendar must be 'retail' (found ${spec.calendar})`);
  for (const [id, m] of Object.entries(spec.measures)) {
    require(IDENTIFIER.test(id), `bad measure name ${id}`);
    if (m?.window != null) {
      require(WINDOWS.includes(m.window), `measure ${id} window must be one of ${[...WINDOWS].sort().join(', ')} (found ${m.window})`);
      const base = m.of ? spec.measures[m.of] : undefined;
      require(base && base.window == null, `measure ${id} must be 'of' a measure that has its own sql`);
      require(spec.calendar != null, `measure ${id} uses a window, so the report needs calendar: retail`);
    } else {
      require(m?.sql && !m.sql.includes(';'), `bad measure sql on ${id}`);
    }
  }
  for (const f of spec.filters ?? []) {
    require(f?.type && FILTER_TYPES.includes(f.type), `filter type must be one of ${[...FILTER_TYPES].sort().join(', ')} (found ${f?.type})`);
    const d = spec.dimensions[f.dimension];
    require(d, `filter uses unknown dimension ${f.dimension}`);
    if (f.type !== 'multi_select') require(d.type === 'date', `a ${f.type} filter needs a date dimension (${f.dimension} is not)`);
    if (f.type === 'retail_week') require(spec.calendar != null, 'a retail_week filter needs calendar: retail');
  }
  const calcs = spec.calculations ?? {};
  for (const [id, c] of Object.entries(calcs)) require(spec.measures[c.of], `calculation ${id} refers to unknown measure ${c.of}`);
  for (const v of spec.visuals ?? []) {
    require(v?.type && VISUAL_TYPES.includes(v.type), `visual type must be one of ${[...VISUAL_TYPES].sort().join(', ')} (found ${v?.type})`);
    require(v.span == null || (Number.isInteger(v.span) && v.span >= 1 && v.span <= 12), `visual '${v.title}' span must be 1 to 12`);
    require(v.limit == null || (Number.isInteger(v.limit) && v.limit >= 1 && v.limit <= 50), `visual '${v.title}' limit must be 1 to 50`);
    for (const d of [...(v.rows ?? []), ...(v.columns ?? [])]) require(spec.dimensions[d], `visual '${v.title}' uses unknown dimension ${d}`);
    for (const val of v.values ?? []) require(spec.measures[val] || calcs[val], `visual '${v.title}' uses unknown value ${val}`);
    for (const it of v.items ?? []) {
      require(spec.measures[it.measure], `KPI '${it.label}' uses unknown measure ${it.measure}`);
      require(!it.icon || KPI_ICONS.includes(it.icon), `KPI '${it.label}' icon must be one of ${[...KPI_ICONS].sort().join(', ')}`);
    }
  }
}

function parseSpec(yaml: string, sql: string): { spec: FullSpec; sql: string } {
  let spec: FullSpec;
  try {
    spec = parseYaml(yaml) as FullSpec;
  } catch (e) {
    throw new BadRequest(`report.yaml is not valid YAML: ${(e as Error).message.split('\n')[0]}`);
  }
  const clean = cleanSql(sql);
  validate(spec, clean);
  spec.filters = spec.filters ?? [];
  spec.visuals = spec.visuals ?? [];
  spec.calculations = spec.calculations ?? {};
  return { spec, sql: clean };
}

/** The dry run: with no database, the SQL must be one of the bundled datasets, and every field must exist in it. */
function dryRun(spec: FullSpec, sql: string): { rows: DataRow[]; source: DataSource; eval: Record<string, Agg> } {
  const ds = DATASETS.find((d) => d.sql === normalise(sql));
  if (!ds) {
    throw new BadRequest(
      'this online copy has no database, so it can only run the example dataset.sql. The full engine runs any read-only SELECT against PostgreSQL.',
    );
  }
  const columns = new Set(Object.keys(ds.rows[0] ?? {}));
  for (const d of Object.values(spec.dimensions)) {
    if (!columns.has(d.column)) throw new BadRequest(`column d.${d.column} does not exist`);
    if (d.sort_by && !columns.has(d.sort_by)) throw new BadRequest(`column d.${d.sort_by} does not exist`);
  }
  const ev: Record<string, Agg> = {};
  for (const [id, m] of Object.entries(spec.measures)) if (m.window == null) ev[id] = compileMeasure(m.sql!, columns);
  // A windowed measure is its base measure; the window only changes the dates (see runQuery).
  for (const [id, m] of Object.entries(spec.measures)) if (m.window != null) ev[id] = ev[m.of!];
  return { rows: ds.rows, source: ds.source, eval: ev };
}

// ---------- the registry ----------
const reports = new Map<string, Report>();
function register(yaml: string, sql: string, builtIn: boolean) {
  const p = parseSpec(yaml, sql);
  const d = dryRun(p.spec, p.sql);
  reports.set(p.spec.id, { spec: p.spec, rows: d.rows, source: d.source, eval: d.eval, builtIn, yaml, sql });
}
// A report that fails its checks is left out and logged; it must never stop the other reports from loading.
for (const [id, yaml, sql] of BUILT_IN) {
  try {
    register(yaml, sql, true);
  } catch (e) {
    console.error(`${id} not loaded:`, (e as Error).message);
  }
}

function loadImported(): { yaml: string; sql: string }[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]');
  } catch {
    return [];
  }
}
for (const r of loadImported()) {
  try {
    register(r.yaml, r.sql, false);
  } catch {
    /* an earlier upload that no longer passes is skipped */
  }
}
function saveImported() {
  try {
    const list = [...reports.values()].filter((r) => !r.builtIn).map((r) => ({ yaml: r.yaml, sql: r.sql }));
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  } catch {
    /* the upload just won't survive a reload */
  }
}

function report(id: string): Report {
  const r = reports.get(id);
  if (!r) throw new Error(`404: No report ${id}`);
  return r;
}

// ---------- queries (same meaning as SqlBuilder.build + Calculations.apply) ----------
function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1; // NULLS LAST
  if (b === null || b === undefined) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const x = String(a), y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

function filterRows(r: Report, q: Pick<QueryRequest, 'filters' | 'exclude' | 'dateFrom' | 'dateTo'>): DataRow[] {
  const dims = r.spec.dimensions;
  const dateDim = dateDimension(r.spec);
  const checks: ((row: DataRow) => boolean)[] = [];
  const add = (f: Record<string, string[]> | undefined, exclude: boolean) => {
    for (const [id, values] of Object.entries(f ?? {})) {
      if (!values?.length) continue;
      const d = dims[id];
      if (!d) throw new BadRequest(`Unknown dimension: ${id}`);
      if (d.type === 'date') throw new BadRequest(`Use dateFrom/dateTo for ${id}`);
      const set = new Set(values.map(String));
      checks.push(exclude
        ? (row) => row[d.column] === null || !set.has(String(row[d.column]))
        : (row) => row[d.column] !== null && set.has(String(row[d.column])));
    }
  };
  add(q.filters, false);
  add(q.exclude, true);
  if (q.dateFrom || q.dateTo) {
    if (!dateDim) throw new BadRequest('This report has no date dimension');
    if (q.dateFrom) checks.push((row) => row[dateDim.column] !== null && String(row[dateDim.column]) >= q.dateFrom!);
    if (q.dateTo) checks.push((row) => row[dateDim.column] !== null && String(row[dateDim.column]) <= q.dateTo!);
  }
  return r.rows.filter((row) => checks.every((c) => c(row)));
}

// ---------- the retail calendar (the demo builds it; the engine reads reports/_shared/retail_calendar.sql) ----------
// Weeks run Sunday to Saturday. Week 1 is the week holding 1 January when that is a Sunday to Thursday, else the week
// after (checked against the old report: 2021-01-03, 2022-01-02, 2023-01-01, 2023-12-31, 2024-12-29, 2025-12-28).
// Periods are 4-4-5 weeks, a 53rd week joins period 12.
const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
function retailYearStart(year: number): number {
  const jan1 = Date.UTC(year, 0, 1);
  const dow = new Date(jan1).getUTCDay(); // 0 = Sunday
  return dow <= 4 ? jan1 - dow * DAY : jan1 + (7 - dow) * DAY;
}
const PERIOD_ENDS = [4, 8, 13, 17, 21, 26, 30, 34, 39, 43, 47, 52];
type CalendarWeek = RetailWeek & { period_start: string; year_start: string };
const CALENDAR: CalendarWeek[] = (() => {
  const out: CalendarWeek[] = [];
  for (let y = 2019; y <= 2030; y++) {
    const start = retailYearStart(y);
    const weeks = Math.round((retailYearStart(y + 1) - start) / (7 * DAY));
    const periodStart: Record<number, string> = {};
    for (let w = 1; w <= weeks; w++) {
      const period = PERIOD_ENDS.findIndex((end) => w <= end) + 1 || 12;
      const ws = start + (w - 1) * 7 * DAY;
      periodStart[period] ??= iso(ws);
      out.push({ retail_year: y, retail_period: period, retail_week: w, week_start: iso(ws), week_end: iso(ws + 6 * DAY), period_start: periodStart[period], year_start: iso(start) });
    }
  }
  return out;
})();
const calendarWeekOf = (day: string) => CALENDAR.find((w) => w.week_start <= day && day <= w.week_end);

/** The date the date filter applies to: the report's date filter's dimension, else its first date (as SqlBuilder). */
function dateDimension(spec: FullSpec): FullDimension | undefined {
  for (const f of spec.filters ?? []) {
    const d = spec.dimensions[f.dimension];
    if (d?.type === 'date' && f.type !== 'multi_select') return d;
  }
  return Object.values(spec.dimensions).find((d) => d.type === 'date');
}

const shiftDay = (day: string, days: number) => iso(Date.parse(`${day}T00:00:00Z`) + days * DAY);
/** The same calendar date `years` years away; 29 Feb becomes 28 Feb, as in Java's LocalDate.plusYears. */
const shiftYear = (day: string | undefined, years: number) => {
  if (!day) return day;
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  const last = new Date(Date.UTC(y + years, m, 0)).getUTCDate();
  return `${y + years}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
};

/**
 * Measures over other dates (same rules as Windows.java): wtd / ptd / ytd from the start of the retail week, period
 * or year of the last selected day; py = the selected days one retail year earlier, with rows grouped by a date moved
 * onto this year's dates; yoy = value - py (a missing py counts as 0); yoy_pct = (value - py) / py.
 * mtd starts on the 1st of the calendar month; py_fin = the same calendar dates one year earlier, with yoy_fin /
 * yoy_fin_pct against it. Each window runs over its own dates, widest first, then the rows are joined on the groups.
 */
function runQuery(r: Report, q: QueryRequest): Row[] {
  const order = ['ytd', 'ptd', 'mtd', 'wtd', 'py', 'py_fin', ''];
  const plan = new Map<string, Map<string, string>>(order.map((w) => [w, new Map()]));
  for (const m of q.measures ?? []) {
    const spec = r.spec.measures[m];
    const w = spec?.window ?? '';
    if (w === 'yoy' || w === 'yoy_pct') {
      plan.get('')!.set(`_cur__${spec!.of}`, spec!.of!);
      plan.get('py')!.set(`_py__${spec!.of}`, spec!.of!);
    } else if (w === 'yoy_fin' || w === 'yoy_fin_pct') {
      plan.get('')!.set(`_cur__${spec!.of}`, spec!.of!);
      plan.get('py_fin')!.set(`_pyfin__${spec!.of}`, spec!.of!);
    } else plan.get(w)!.set(m, m);
  }
  for (const w of order) if (!plan.get(w)!.size) plan.delete(w);
  let rows: Row[];
  if (![...plan.keys()].some((w) => w !== '')) {
    rows = runOnce(r, q);
  } else {
    if (!q.dateTo) throw new BadRequest('Week, period, year to date and last year need a selected end date');
    const week = calendarWeekOf(q.dateTo);
    if (!week) throw new BadRequest(`${q.dateTo} is not in the retail calendar`);
    const start: Record<string, string | undefined> = { wtd: week.week_start, ptd: week.period_start, mtd: `${q.dateTo.slice(0, 7)}-01`, ytd: week.year_start, py: q.dateFrom, py_fin: q.dateFrom, '': q.dateFrom };
    const pyShift = Math.round((Date.parse(week.year_start) - retailYearStart(week.retail_year - 1)) / DAY);
    const groupBy = q.groupBy ?? [];
    const dateCols = groupBy.filter((g) => r.spec.dimensions[g]?.type === 'date');
    const merged = new Map<string, Row>();
    for (const [w, cols] of plan) {
      const aliases = [...cols.keys()];
      const evalFor: Record<string, Agg> = { ...r.eval };
      for (const [alias, id] of cols) evalFor[alias] = r.eval[id];
      const shift = w === 'py' ? pyShift : 0;
      const fin = w === 'py_fin';
      const from = fin ? shiftYear(start[w], -1) : start[w] && shift ? shiftDay(start[w]!, -shift) : start[w];
      const to = fin ? shiftYear(q.dateTo, -1)! : shift ? shiftDay(q.dateTo, -shift) : q.dateTo;
      for (const row of runOnce({ ...r, eval: evalFor }, { ...q, measures: aliases, calculations: undefined, dateFrom: from, dateTo: to })) {
        for (const c of dateCols) {
          if (row[c] == null) continue;
          if (fin) row[c] = shiftYear(String(row[c]), 1)!;
          else if (shift) row[c] = shiftDay(String(row[c]), shift);
        }
        const key = JSON.stringify(groupBy.map((g) => row[g]));
        let out = merged.get(key);
        if (!out) {
          out = Object.fromEntries(groupBy.map((g) => [g, row[g]])) as Row;
          merged.set(key, out);
        }
        for (const a of aliases) out[a] = row[a];
      }
    }
    rows = [...merged.values()];
    if (!rows.length && !groupBy.length) rows = [{}];
    for (const row of rows) {
      for (const m of q.measures) {
        const spec = r.spec.measures[m];
        if (spec?.window === 'yoy' || spec?.window === 'yoy_pct' || spec?.window === 'yoy_fin' || spec?.window === 'yoy_fin_pct') {
          const cur = row[`_cur__${spec.of}`] as number | null | undefined;
          const py = row[`${spec.window.startsWith('yoy_fin') ? '_pyfin__' : '_py__'}${spec.of}`] as number | null | undefined;
          row[m] = spec.window === 'yoy' || spec.window === 'yoy_fin'
            ? (cur == null && py == null ? null : round((cur ?? 0) - (py ?? 0)))
            : (cur == null || py == null || py === 0 ? null : (cur - py) / py);
        } else if (!(m in row)) row[m] = null;
      }
      for (const k of Object.keys(row)) if (k.startsWith('_cur__') || k.startsWith('_py__') || k.startsWith('_pyfin__')) delete row[k];
    }
  }
  for (const [calcId, modeId] of Object.entries(q.calculations ?? {})) {
    const calc = r.spec.calculations?.[calcId];
    if (!calc) throw new BadRequest(`Unknown calculation: ${calcId}`);
    const mode = calc.modes[modeId ?? calc.default_mode];
    if (!mode) throw new BadRequest(`Unknown mode ${modeId} for ${calcId}`);
    if (!q.measures.includes(calc.of)) throw new BadRequest(`${calcId} needs measure ${calc.of} in the request`);
    applyCalculation(mode.type, calcId, calc.of, rows);
  }
  return rows;
}

function runOnce(r: Report, q: QueryRequest): Row[] {
  const groupBy = q.groupBy ?? [];
  if (!q.measures?.length) throw new BadRequest('At least one measure is required');
  for (const m of q.measures) if (!r.eval[m]) throw new BadRequest(`Unknown measure: ${m}`);
  const dims = groupBy.map((id) => {
    const d = r.spec.dimensions[id];
    if (!d) throw new BadRequest(`Unknown dimension: ${id}`);
    return { id, ...d };
  });
  const rows = filterRows(r, q);

  const groups = new Map<string, DataRow[]>();
  if (dims.length === 0) groups.set('', rows);
  else {
    for (const row of rows) {
      const key = JSON.stringify(dims.map((d) => row[d.column]));
      const g = groups.get(key);
      if (g) g.push(row);
      else groups.set(key, [row]);
    }
  }

  type Out = { row: Row; sort: unknown[] };
  const out: Out[] = [];
  for (const g of groups.values()) {
    const row: Row = {};
    const sort: unknown[] = [];
    for (const d of dims) {
      row[d.id] = g[0][d.column];
      if (d.sort_by) {
        const vals = g.map((x) => x[d.sort_by!]).filter((v) => v !== null && v !== undefined);
        sort.push(vals.length ? vals.reduce((a, b) => (compare(a, b) <= 0 ? a : b)) : null);
      }
      sort.push(g[0][d.column]);
    }
    for (const m of q.measures) row[m] = r.eval[m](g);
    out.push({ row, sort });
  }
  out.sort((a, b) => {
    for (let i = 0; i < a.sort.length; i++) {
      const c = compare(a.sort[i], b.sort[i]);
      if (c) return c;
    }
    return 0;
  });
  return out.map((o) => o.row);
}

function applyCalculation(type: string, out: string, of: string, rows: Row[]) {
  const v = (r: Row) => Number(r[of] ?? 0);
  const divide = (a: number, total: number) => (total === 0 ? null : a / total);
  const total = rows.reduce((s, r) => s + v(r), 0);
  if (type === 'share_of_total') {
    rows.forEach((r) => (r[out] = divide(v(r), total)));
  } else if (type === 'tender_legacy_share') {
    // The old Power BI "% to Total": Cash divides by the grand total, every other row by the non-cash total.
    if (!rows.length || !('payment_type' in rows[0])) {
      rows.forEach((r) => (r[out] = divide(v(r), total)));
      return;
    }
    const nonCash = rows.filter((r) => r.payment_type !== 'Cash').reduce((s, r) => s + v(r), 0);
    rows.forEach((r) => (r[out] = divide(v(r), r.payment_type === 'Cash' ? total : nonCash)));
  } else throw new BadRequest(`Unknown calculation type: ${type}`);
}

function publicSpec(r: Report): Spec {
  const dimensions: Spec['dimensions'] = {};
  for (const [id, d] of Object.entries(r.spec.dimensions)) dimensions[id] = { label: d.label, type: d.type ?? null };
  const measures: Spec['measures'] = {};
  for (const [id, m] of Object.entries(r.spec.measures)) measures[id] = { label: m.label, format: (m.format ?? null) as Spec['measures'][string]['format'] };
  const { id, title, subtitle, calculations, filters, visuals } = r.spec;
  const notice = r.builtIn
    ? dataNotice(id, r.source)
    : { title: 'Uploaded report.', text: `Runs on the same rows as the built-in report with this SQL (${r.source === 'export' ? 'its DEV export' : 'made-up sample rows'}).` };
  return { id, title, subtitle, sampleDataNotice: notice.text, dataNoticeTitle: notice.title, dataSource: r.source, dimensions, measures, calculations: calculations ?? {}, filters, visuals };
}

// Answers arrive a moment later, like a real request, so loading states still show.
const later = <T,>(fn: () => T): Promise<T> =>
  new Promise((resolve, reject) => setTimeout(() => {
    try {
      resolve(fn());
    } catch (e) {
      reject(e instanceof BadRequest ? new Error(`400: ${e.message}`) : e);
    }
  }, 60));

function importReport(yaml: string, sql: string, publish: boolean): ImportResult {
  const checks: ImportCheck[] = [];
  let parsed: { spec: FullSpec; sql: string };
  try {
    parsed = parseSpec(yaml, sql);
    const s = parsed.spec;
    checks.push({ name: 'Settings file is valid', ok: true, detail: `${Object.keys(s.dimensions).length} fields, ${Object.keys(s.measures).length} measures, ${s.visuals.length} visuals` });
    checks.push({ name: 'SQL only reads data', ok: true, detail: 'single SELECT statement' });
  } catch (e) {
    checks.push({ name: 'Settings file is valid', ok: false, detail: (e as Error).message });
    return { ok: false, id: null, title: null, checks };
  }
  const { spec } = parsed;
  const existing = reports.get(spec.id);
  if (existing?.builtIn) {
    checks.push({ name: 'Report id is free', ok: false, detail: `'${spec.id}' is a built-in report and cannot be replaced by an upload` });
    return { ok: false, id: spec.id, title: spec.title, checks };
  }
  checks.push({ name: 'Report id is free', ok: true, detail: existing ? 'replaces the earlier upload' : spec.id });
  try {
    dryRun(spec, parsed.sql);
    checks.push({ name: 'Runs on the database', ok: true, detail: 'every field and measure checked against the rows in this browser (offline copy)' });
  } catch (e) {
    checks.push({ name: 'Runs on the database', ok: false, detail: (e as Error).message });
    return { ok: false, id: spec.id, title: spec.title, checks };
  }
  if (publish) {
    register(yaml, sql, false);
    saveImported();
    checks.push({ name: 'Published', ok: true, detail: `live now at #/r/${spec.id} (saved in this browser only)` });
  }
  return { ok: true, id: spec.id, title: spec.title, checks };
}

export const staticApi = {
  reports: () => later<ReportSummary[]>(() => [...reports.values()]
    .sort((a, b) => a.spec.id.localeCompare(b.spec.id))
    .map((r) => ({ id: r.spec.id, title: r.spec.title, subtitle: r.spec.subtitle, imported: !r.builtIn, visuals: r.spec.visuals.length, dataSource: r.source }))),
  spec: (id: string) => later(() => publicSpec(report(id))),
  values: (id: string, dim: string) => later(() => {
    const r = report(id);
    const d = r.spec.dimensions[dim];
    if (!d) throw new BadRequest(`Unknown dimension: ${dim}`);
    const rows = runQuery({ ...r, eval: { _n: (g) => g.length } }, { groupBy: [dim], measures: ['_n'] });
    return rows.map((x) => x[dim]).filter((v) => v !== null) as string[];
  }),
  dateBounds: (id: string) => later(() => {
    const r = report(id);
    const d = dateDimension(r.spec);
    if (!d) throw new BadRequest('This report has no date dimension');
    const days = r.rows.map((x) => x[d.column]).filter((v) => v !== null).map(String).sort();
    // open_on: the latest day where that column is not 0 (as SqlBuilder.dateBounds), else the latest day.
    const openOn = r.spec.filters.find((f) => f.open_on && f.type !== 'multi_select')?.open_on;
    const withValue = openOn ? r.rows.filter((x) => x[d.column] !== null && Number(x[openOn] ?? 0) !== 0).map((x) => String(x[d.column])).sort() : [];
    return { min_date: days[0], max_date: withValue[withValue.length - 1] ?? days[days.length - 1] };
  }),
  calendar: (id: string) => later<RetailWeek[]>(() => {
    if (!report(id).spec.calendar) throw new BadRequest('This report has no retail calendar');
    return CALENDAR.map(({ retail_year, retail_period, retail_week, week_start, week_end }) => ({ retail_year, retail_period, retail_week, week_start, week_end }));
  }),
  mapping: (id: string) => later(() => {
    report(id);
    if (id !== 'tender-report') throw new Error(`404: No mapping recorded for ${id}`);
    return tenderMapping as unknown as Mapping;
  }),
  importReport: (yaml: string, sql: string, publish: boolean) => later(() => importReport(yaml, sql, publish)),
  query: (id: string, body: QueryRequest) => later(() => runQuery(report(id), body)),
};
