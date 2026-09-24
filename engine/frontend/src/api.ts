// Talks to the report engine API. The browser only ever sends names from the spec and filter values - never SQL.

export type Dimension = { label: string; type: string | null };
export type Measure = { label: string; format: 'currency' | 'percent' | 'number' | null };
export type Mode = { type: string; label: string };
export type Calculation = { label: string; of: string; format: string; modes: Record<string, Mode>; default_mode: string };
export type Filter = { dimension: string; type: 'multi_select' | 'date_range'; default_last_days?: number };
export type KpiItem = { label: string; measure: string; include?: Record<string, string[]>; exclude?: Record<string, string[]> };
export type Visual = {
  type: 'kpi' | 'table' | 'bar' | 'matrix';
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
export type ReportSummary = { id: string; title: string; subtitle?: string };
export type Row = Record<string, string | number | null>;

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

export const api = {
  reports: () => fetch('/api/reports').then((r) => json<ReportSummary[]>(r)),
  spec: (id: string) => fetch(`/api/reports/${id}`).then((r) => json<Spec>(r)),
  values: (id: string, dim: string) => fetch(`/api/reports/${id}/values/${dim}`).then((r) => json<string[]>(r)),
  dateBounds: (id: string) =>
    fetch(`/api/reports/${id}/date-bounds`).then((r) => json<{ min_date: string; max_date: string }>(r)),
  query: (id: string, body: QueryRequest) =>
    fetch(`/api/reports/${id}/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => json<Row[]>(r)),
};
