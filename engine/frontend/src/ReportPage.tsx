import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, CircularProgress, Container } from '@mui/material';
import { useTokens } from './theme';
import { api, QueryRequest, Spec } from './api';
import { addDays } from './format';
import FilterBar, { FilterState, weeksWithData } from './components/FilterBar';
import KpiRow from './components/KpiRow';
import SummaryTable from './components/SummaryTable';
import BarChartVisual from './components/BarChartVisual';
import MatrixVisual from './components/MatrixVisual';
import LineChartVisual from './components/LineChartVisual';
import DonutVisual from './components/DonutVisual';
import LeaderboardVisual from './components/LeaderboardVisual';
import Reveal from './components/Reveal';
import { Visual } from './api';
import { CatalogEntry } from './catalog';
import ReportHeader from './components/ReportHeader';
import { alpha } from '@mui/material/styles';

/** Default width of each visual on the 12-column grid (a report can override it with `span`). */
const DEFAULT_SPAN: Record<Visual['type'], number> = { kpi: 12, line: 12, table: 5, bar: 7, matrix: 12, donut: 4, leaderboard: 12 };
const COMPONENTS = {
  table: SummaryTable, bar: BarChartVisual, matrix: MatrixVisual, line: LineChartVisual, donut: DonutVisual, leaderboard: LeaderboardVisual,
} as const;

/** Draws any report from its spec: the filter bar on top, then each visual in order. */
export default function ReportPage({ reportId, entry }: { reportId: string; entry: CatalogEntry }) {
  const tokens = useTokens();
  const [spec, setSpec] = useState<Spec>();
  const [filters, setFilters] = useState<FilterState>();
  const [defaults, setDefaults] = useState<FilterState>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    setSpec(undefined);
    setError(undefined);
    Promise.all([api.spec(reportId), api.dateBounds(reportId)])
      .then(async ([s, bounds]) => {
        const dateFilter = s.filters.find((f) => f.type === 'date_range');
        const days = dateFilter?.default_last_days ?? 30;
        const initial: FilterState = {
          values: {},
          dateFrom: addDays(bounds.max_date, -(days - 1)) < bounds.min_date ? bounds.min_date : addDays(bounds.max_date, -(days - 1)),
          dateTo: bounds.max_date,
          minDate: bounds.min_date,
          maxDate: bounds.max_date,
        };
        // A retail-week report opens on the latest week that has data, like the old report's Calendar slicer.
        if (s.filters.some((f) => f.type === 'retail_week')) {
          const weeks = weeksWithData(await api.calendar(reportId), bounds.min_date, bounds.max_date);
          const latest = weeks[weeks.length - 1];
          if (!latest) throw new Error('No retail week in the calendar covers the data in this report');
          Object.assign(initial, { dateFrom: latest.week_start, dateTo: latest.week_end, weeks });
        }
        setSpec(s);
        setDefaults(initial);
        setFilters(initial);
      })
      .catch((e) => setError(String(e)));
  }, [reportId]);

  // Every visual starts from the same filters; each adds its own grouping and measures.
  const base: Omit<QueryRequest, 'measures'> | undefined = useMemo(
    () => filters && { filters: filters.values, dateFrom: filters.dateFrom, dateTo: filters.dateTo },
    [filters],
  );

  if (error) return <Container sx={{ py: 4 }}><Alert severity="error">{error}</Alert></Container>;
  if (!spec || !filters || !base || !defaults) {
    return <Box sx={{ display: 'grid', placeItems: 'center', py: 12 }}><CircularProgress thickness={2.5} size={46} /></Box>;
  }

  return (
    <Container maxWidth={false} sx={{ py: 3, maxWidth: 1500 }}>
      <ReportHeader
        entry={entry}
        subtitle={spec.subtitle}
        status={spec.dataNoticeTitle?.replace(/\.$/, '') ?? 'Live'}
        statusColour={tokens.good}
        right={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: tokens.textSecondary, fontSize: '0.8rem', fontFamily: tokens.mono }}>
            <Box
              sx={{
                width: 8, height: 8, borderRadius: '50%', bgcolor: tokens.good, boxShadow: `0 0 10px ${tokens.good}`,
                animation: 'pulse 2s ease-in-out infinite',
                '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
              }}
            />
            {weekLabel(filters) ?? `${filters.dateFrom} → ${filters.dateTo}`}
          </Box>
        )}
      />
      {spec.sampleDataNotice && (
        <Alert
          severity="info"
          variant="outlined"
          sx={{ mb: 2, bgcolor: alpha(tokens.accent, 0.06), borderColor: alpha(tokens.accent, 0.35), color: tokens.textSecondary, '& .MuiAlert-icon': { color: tokens.accent } }}
        >
          <strong style={{ color: tokens.textPrimary }}>{spec.dataNoticeTitle ?? 'Data.'}</strong> {spec.sampleDataNotice}
        </Alert>
      )}

      <FilterBar reportId={reportId} spec={spec} value={filters} onChange={setFilters} onReset={() => setFilters(defaults)} />

      {/* Every visual in the order the settings file lists them, on a 12-column grid (one column on phones). */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 2, alignItems: 'stretch' }}>
        {spec.visuals.map((v, i) => {
          const span = v.span ?? DEFAULT_SPAN[v.type] ?? 12;
          const body = v.type === 'kpi'
            ? <KpiRow reportId={reportId} spec={spec} visual={v} base={base} />
            : (() => {
              const C = COMPONENTS[v.type];
              return C ? <C reportId={reportId} spec={spec} visual={v} base={base} /> : null;
            })();
          return (
            <Reveal key={`${v.type}-${i}`} index={i} sx={{ gridColumn: { xs: 'span 12', md: span < 6 ? 'span 6' : 'span 12', lg: `span ${span}` } }}>
              {body}
            </Reveal>
          );
        })}
      </Box>
    </Container>
  );
}

/** "Period 9 · Week 37" when a retail week is selected. */
function weekLabel(f: FilterState): string | null {
  const w = f.weeks?.find((x) => x.week_start === f.dateFrom && x.week_end === f.dateTo);
  return w ? `${w.retail_year} · Period ${w.retail_period} · Week ${w.retail_week}` : null;
}
