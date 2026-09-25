// Online demo mode (VITE_STATIC_DEMO=1): the same API as the Java engine, answered inside the browser from
// bundled sample rows, so the page works with no server. The rules match the backend:
//   filters/exclude/dates  -> engine/backend/.../query/SqlBuilder.java
//   % to Total modes       -> engine/backend/.../query/Calculations.java
//   import checks          -> engine/backend/.../spec/ReportRegistry.java + web/ImportController.java
// Only the database dry run differs: there is no database here, so an upload can only use a bundled dataset.
import { parse as parseYaml } from 'yaml';
import type { ImportCheck, ImportResult, Mapping, QueryRequest, ReportSummary, Row, Spec } from '../api';
import tenderYaml from '../../../../reports/tender-report/report.yaml?raw';
import tenderSql from '../../../../reports/tender-report/dataset.sql?raw';
import tenderMapping from '../../../../reports/tender-report/mapping.json';
import tenderRows from '../../../../demo/static-data/tender-rows.json';
import paidoutSql from '../../../../demo/import-example/paidout-report/dataset.sql?raw';
import paidoutRows from '../../../../demo/static-data/paidout-rows.json';
import wasteYaml from '../../../../reports/waste-report/report.yaml?raw';
import wasteSql from '../../../../reports/waste-report/dataset.sql?raw';

// Real figures live in demo/private-data/ (git-ignored - the repository is public). The glob is empty when the
// folder is absent, so a build from a fresh clone simply leaves the real-data report out.
const privateData = import.meta.glob('../../../../demo/private-data/*.json', { eager: true, import: 'default' }) as Record<string, DataRow[]>;
const wasteRows = Object.entries(privateData).find(([path]) => path.endsWith('/waste-rows.json'))?.[1];

type DataRow = Record<string, string | number | null>;
type FullDimension = { label: string; column: string; type?: string | null; sort_by?: string | null };
type FullMeasure = { label: string; sql: string; format?: string | null };
type FullSpec = Omit<Spec, 'dimensions' | 'measures' | 'sampleDataNotice'> & {
  dataset?: string;
  dimensions: Record<string, FullDimension>;
  measures: Record<string, FullMeasure>;
};
type Report = { spec: FullSpec; rows: DataRow[]; builtIn: boolean; yaml: string; sql: string; eval: Record<string, Agg> };
type Agg = (rows: DataRow[]) => number | null;

/** Banner per report: real-data reports say so plainly; everything else is sample data. */
const REAL_DATA_NOTICES: Record<string, { title: string; text: string }> = {
  'waste-report': {
    title: 'Real QA data.',
    text: 'Burger King, week ending Saturday 27 June 2026: one total per plaza from the new database (kios_etl, QA), '
      + 'not yet compared with Power BI. Category, item and district detail are not included in this copy.',
  },
};
const NOTICE = 'All stores, names and amounts on this page are made up. The layout and calculations are real; the numbers are not.';
const STORE_KEY = 're.imported';

class BadRequest extends Error {}

// ---------- datasets: the SQL text decides which bundled rows an uploaded report may use ----------
const normalise = (sql: string) => cleanSql(sql).replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const DATASETS: { sql: string; rows: DataRow[] }[] = [
  { sql: normalise(tenderSql), rows: tenderRows as DataRow[] },
  { sql: normalise(paidoutSql), rows: paidoutRows as DataRow[] },
  ...(wasteRows ? [{ sql: normalise(wasteSql), rows: wasteRows }] : []),
];

// ---------- measures: sum(x), count(*), min/max/avg(x), numbers, + - * / and brackets ----------
function compileMeasure(expr: string, columns: Set<string>): Agg {
  const tokens = expr.match(/\s*([A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?|\*|[-+/()])/g)?.map((s) => s.trim()) ?? [];
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
    if (!['sum', 'count', 'min', 'max', 'avg'].includes(fn)) {
      throw new BadRequest(`this online demo supports sum, count, min, max and avg; found "${t}"`);
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
        return round(op === '+' ? a + b : a - b);
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
const VISUAL_TYPES: string[] = ['kpi', 'line', 'table', 'bar', 'matrix', 'donut', 'leaderboard'];
const KPI_ICONS: string[] = ['total', 'cash', 'card', 'paidout', 'count', 'store', 'trend'];
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
  for (const [id, m] of Object.entries(spec.measures)) {
    require(IDENTIFIER.test(id), `bad measure name ${id}`);
    require(m?.sql && !m.sql.includes(';'), `bad measure sql on ${id}`);
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
function dryRun(spec: FullSpec, sql: string): { rows: DataRow[]; eval: Record<string, Agg> } {
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
  for (const [id, m] of Object.entries(spec.measures)) ev[id] = compileMeasure(m.sql, columns);
  return { rows: ds.rows, eval: ev };
}

// ---------- the registry ----------
const reports = new Map<string, Report>();
function register(yaml: string, sql: string, builtIn: boolean) {
  const p = parseSpec(yaml, sql);
  const d = dryRun(p.spec, p.sql);
  reports.set(p.spec.id, { spec: p.spec, rows: d.rows, eval: d.eval, builtIn, yaml, sql });
}
register(tenderYaml, tenderSql, true);
// A report that fails its checks is left out and logged; it must never stop the other reports from loading.
if (wasteRows) {
  try {
    register(wasteYaml, wasteSql, true);
  } catch (e) {
    console.error('waste-report not loaded:', (e as Error).message);
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
  const dateDim = Object.values(dims).find((d) => d.type === 'date');
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

function runQuery(r: Report, q: QueryRequest): Row[] {
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
  const result = out.map((o) => o.row);

  for (const [calcId, modeId] of Object.entries(q.calculations ?? {})) {
    const calc = r.spec.calculations?.[calcId];
    if (!calc) throw new BadRequest(`Unknown calculation: ${calcId}`);
    const mode = calc.modes[modeId ?? calc.default_mode];
    if (!mode) throw new BadRequest(`Unknown mode ${modeId} for ${calcId}`);
    if (!q.measures.includes(calc.of)) throw new BadRequest(`${calcId} needs measure ${calc.of} in the request`);
    applyCalculation(mode.type, calcId, calc.of, result);
  }
  return result;
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
  const real = REAL_DATA_NOTICES[id];
  return { id, title, subtitle, sampleDataNotice: real ? real.text : NOTICE, dataNoticeTitle: real ? real.title : undefined, dimensions, measures, calculations: calculations ?? {}, filters, visuals };
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
    checks.push({ name: 'Runs on the database', ok: true, detail: 'every field and measure checked against the sample data (online demo)' });
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
    .map((r) => ({ id: r.spec.id, title: r.spec.title, subtitle: r.spec.subtitle, imported: !r.builtIn, visuals: r.spec.visuals.length }))),
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
    const d = Object.values(r.spec.dimensions).find((x) => x.type === 'date');
    if (!d) throw new BadRequest('This report has no date dimension');
    const days = r.rows.map((x) => x[d.column]).filter((v) => v !== null).map(String).sort();
    return { min_date: days[0], max_date: days[days.length - 1] };
  }),
  mapping: (id: string) => later(() => {
    report(id);
    if (id !== 'tender-report') throw new Error(`404: No mapping recorded for ${id}`);
    return tenderMapping as unknown as Mapping;
  }),
  importReport: (yaml: string, sql: string, publish: boolean) => later(() => importReport(yaml, sql, publish)),
  query: (id: string, body: QueryRequest) => later(() => runQuery(report(id), body)),
};
