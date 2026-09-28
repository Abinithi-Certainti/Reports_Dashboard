// Talks to the report engine API. The browser only ever sends names from the spec and filter values - never SQL.

export type Dimension = { label: string; type: string | null };
export type Measure = { label: string; format: 'currency' | 'percent' | 'number' | null };
export type Mode = { type: string; label: string };
export type Calculation = { label: string; of: string; format: string; modes: Record<string, Mode>; default_mode: string };
export type Filter = { dimension: string; type: 'multi_select' | 'date_range' | 'retail_week'; default_last_days?: number; open_on?: string };
/** One retail week (Sunday to Saturday), from the report's retail calendar. */
export type RetailWeek = { retail_year: number; retail_period: number; retail_week: number; week_start: string; week_end: string };
export type KpiItem = {
  label: string;
  measure: string;
  include?: Record<string, string[]>;
  exclude?: Record<string, string[]>;
  good_direction?: 'up' | 'down' | null;
  icon?: 'total' | 'cash' | 'card' | 'paidout' | 'count' | 'store' | 'trend' | null;
};
export type Visual = {
  type: 'kpi' | 'table' | 'bar' | 'matrix' | 'line' | 'donut' | 'leaderboard' | 'split' | 'waterfall' | 'stack' | 'heatmap';
  title?: string;
  rows?: string[];
  columns?: string[];
  values?: string[];
  items?: KpiItem[];
  total_row?: boolean;
  span?: number | null;  // width on a 12-column grid; each type has a default
  limit?: number | null; // leaderboard: how many rows. donut: how many slices before the rest become "Other"
  highlight?: string[] | null; // split: the values of rows[0] shown as the first part (e.g. [Cash]); the rest is the second part
  signs?: string[] | null; // waterfall: '+' or '-' per value (step)
  total?: string | null;   // waterfall: the measure the steps should arrive at
};
export type Spec = {
  id: string;
  title: string;
  subtitle?: string;
  sampleDataNotice?: string;
  dataNoticeTitle?: string; // banner heading; "Sample data." when not set
  dataSource?: DataSource; // set by the frontend: where this report's rows come from
  dimensions: Record<string, Dimension>;
  measures: Record<string, Measure>;
  calculations: Record<string, Calculation>;
  filters: Filter[];
  visuals: Visual[];
};
export type ReportSummary = { id: string; title: string; subtitle?: string; imported: boolean; visuals: number; dataSource?: DataSource };
/** Where a report's rows come from: the live backend, a DEV export loaded in the browser, or made-up sample rows. */
export type DataSource = 'live' | 'export' | 'sample';
export type Row = Record<string, string | number | null>;

export type MappingColumn = { old_column: string; new_column: string; new_type: string; method: 'exact' | 'snake_case' | 'manual'; confirmed_by: string | null };
export type MappingTable = { old_table: string; new_table: string; confirmed: boolean; evidence: string; columns: MappingColumn[] };
export type Mapping = {
  report: string;
  source: { server: string; database: string; schema: string };
  target: { database: string; schema: string };
  extracted_on: string;
  tables: MappingTable[];
  rules: { rule: string; found_in: string; decision: string }[];
  findings: { severity: 'high' | 'medium' | 'low'; finding: string; verified: boolean; status: string; decision_owner: string | null }[];
};
export type ImportCheck = { name: string; ok: boolean; detail: string };
export type ImportResult = { ok: boolean; id: string | null; title: string | null; checks: ImportCheck[] };

export type QueryRequest = {
  filters?: Record<string, string[]>;
  exclude?: Record<string, string[]>;
  dateFrom?: string;
  dateTo?: string;
  groupBy?: string[];
  measures: string[];
  calculations?: Record<string, string>;
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

const httpApi = {
  reports: () => fetch('/api/reports').then((r) => json<ReportSummary[]>(r)),
  spec: (id: string) => fetch(`/api/reports/${id}`).then((r) => json<Spec>(r)),
  values: (id: string, dim: string) => fetch(`/api/reports/${id}/values/${dim}`).then((r) => json<string[]>(r)),
  dateBounds: (id: string) =>
    fetch(`/api/reports/${id}/date-bounds`).then((r) => json<{ min_date: string; max_date: string }>(r)),
  calendar: (id: string) => fetch(`/api/reports/${id}/calendar`).then((r) => json<RetailWeek[]>(r)),
  mapping: (id: string) => fetch(`/api/reports/${id}/mapping`).then((r) => json<Mapping>(r)),
  importReport: (yaml: string, sql: string, publish: boolean) =>
    fetch(publish ? '/api/admin/reports' : '/api/admin/reports/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ yaml, sql }),
    }).then(async (r) => (await r.json()) as ImportResult),
  query: (id: string, body: QueryRequest) =>
    fetch(`/api/reports/${id}/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => json<Row[]>(r)),
};

// Which data the dashboard uses is decided once, at start-up:
//   live    - GET /api/health says the backend's database is up: every call goes to the Java engine (httpApi).
//   offline - the backend is not running, its database is down, or it does not answer within 3 s: every call is
//             answered in the browser by src/static/staticApi.ts, from the DEV export in demo/private-data/<id>.json
//             when there is one, else from made-up sample rows (src/static/sampleData.ts), clearly labelled.
// `npm run build:static` (VITE_STATIC_DEMO=1) has no server, so it skips the check and starts offline.
export type DataMode = 'live' | 'offline';
export const isStaticDemo = import.meta.env.VITE_STATIC_DEMO === '1';
const HEALTH_TIMEOUT_MS = 3000;

async function detectMode(): Promise<DataMode> {
  if (isStaticDemo) return 'offline';
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch('/api/health', { signal: abort.signal, cache: 'no-store' });
    if (!res.ok) return 'offline';
    const body = (await res.json()) as { database?: string };
    return body?.database === 'up' ? 'live' : 'offline';
  } catch {
    return 'offline';
  } finally {
    clearTimeout(timer);
  }
}

/** Resolves once the start-up check is done. */
export const dataModeReady: Promise<DataMode> = detectMode();
let currentMode: DataMode | undefined;
dataModeReady.then((m) => (currentMode = m));
/** The mode once known (undefined while the check runs). Components render only after api.reports() answers. */
export const dataMode = () => currentMode;

type Api = typeof httpApi;
// Live answers carry their source, so the page can say "Live DEV data".
const liveApi: Api = {
  ...httpApi,
  reports: () => httpApi.reports().then((list) => list.map((r) => ({ ...r, dataSource: 'live' as const }))),
  spec: (id) => httpApi.spec(id).then((s) => ({ ...s, dataSource: 'live' as const })),
};
// The in-browser engine is loaded only when it is needed (the single-file build inlines it).
const backend: Promise<Api> = dataModeReady.then((m) =>
  m === 'live' ? liveApi : import('./static/staticApi').then((mod) => mod.staticApi as Api));

/** One API for every component; each call waits for the start-up check, then goes to the chosen source. */
export const api: Api = {
  reports: () => backend.then((a) => a.reports()),
  spec: (id) => backend.then((a) => a.spec(id)),
  values: (id, dim) => backend.then((a) => a.values(id, dim)),
  dateBounds: (id) => backend.then((a) => a.dateBounds(id)),
  calendar: (id) => backend.then((a) => a.calendar(id)),
  mapping: (id) => backend.then((a) => a.mapping(id)),
  importReport: (yaml, sql, publish) => backend.then((a) => a.importReport(yaml, sql, publish)),
  query: (id, body) => backend.then((a) => a.query(id, body)),
};
