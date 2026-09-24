import { staticApi } from './static/staticApi';

// Talks to the report engine API. The browser only ever sends names from the spec and filter values - never SQL.

export type Dimension = { label: string; type: string | null };
export type Measure = { label: string; format: 'currency' | 'percent' | 'number' | null };
export type Mode = { type: string; label: string };
export type Calculation = { label: string; of: string; format: string; modes: Record<string, Mode>; default_mode: string };
export type Filter = { dimension: string; type: 'multi_select' | 'date_range'; default_last_days?: number };
export type KpiItem = {
  label: string;
  measure: string;
  include?: Record<string, string[]>;
  exclude?: Record<string, string[]>;
  good_direction?: 'up' | 'down' | null;
};
export type Visual = {
  type: 'kpi' | 'table' | 'bar' | 'matrix' | 'line';
  title?: string;
  rows?: string[];
  columns?: string[];
  values?: string[];
  items?: KpiItem[];
  total_row?: boolean;
};
export type Spec = {
  id: string;
  title: string;
  subtitle?: string;
  sampleDataNotice?: string;
  dimensions: Record<string, Dimension>;
  measures: Record<string, Measure>;
  calculations: Record<string, Calculation>;
  filters: Filter[];
  visuals: Visual[];
};
export type ReportSummary = { id: string; title: string; subtitle?: string; imported: boolean; visuals: number };
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

// VITE_STATIC_DEMO=1 builds the online demo: same calls, answered in the browser from bundled sample data.
// The flag is fixed at build time, so the normal build does not carry the demo data.
export const isStaticDemo = import.meta.env.VITE_STATIC_DEMO === '1';
export const api: typeof httpApi = isStaticDemo ? staticApi : httpApi;
