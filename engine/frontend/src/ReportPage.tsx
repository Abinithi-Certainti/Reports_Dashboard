import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, CircularProgress, Container, Tooltip, Typography } from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useTokens } from './theme';
import { api, DataSource, QueryRequest, Spec } from './api';
import { SAMPLE_ORANGE, SOURCE_LABEL, sourceColour } from './dataSource';
import { addDays } from './format';
import FilterBar, { FilterState, weeksWithData } from './components/FilterBar';
import KpiRow from './components/KpiRow';
import SummaryTable from './components/SummaryTable';
import BarChartVisual from './components/BarChartVisual';
import MatrixVisual from './components/MatrixVisual';
import LineChartVisual from './components/LineChartVisual';
import DonutVisual from './components/DonutVisual';
import SplitVisual from './components/SplitVisual';
import WaterfallVisual from './components/WaterfallVisual';
import StackVisual from './components/StackVisual';
import HeatmapVisual from './components/HeatmapVisual';
import LeaderboardVisual from './components/LeaderboardVisual';
import Reveal from './components/Reveal';
import { Visual } from './api';
import { CatalogEntry } from './catalog';
import ReportHeader from './components/ReportHeader';
import PlazaDetail, { PLAZA_DIM, PlazaContext } from './components/PlazaDetail';
import { formatRange } from './components/CalendarPopover';
import { alpha } from '@mui/material/styles';

/** Default width of each visual on the 12-column grid (a report can override it with `span`). */
const DEFAULT_SPAN: Record<Visual['type'], number> = { kpi: 12, line: 12, table: 5, bar: 7, matrix: 12, donut: 4, leaderboard: 12, split: 6, waterfall: 6, stack: 6, heatmap: 12 };
const COMPONENTS = {
  table: SummaryTable, bar: BarChartVisual, matrix: MatrixVisual, line: LineChartVisual, donut: DonutVisual, leaderboard: LeaderboardVisual, split: SplitVisual,
  waterfall: WaterfallVisual, stack: StackVisual, heatmap: HeatmapVisual,
} as const;

/** Draws any report from its spec: the filter bar on top, then each visual in order. */
export default function ReportPage({ reportId, entry, source: listedSource }: { reportId: string; entry: CatalogEntry; source: DataSource }) {
  const tokens = useTokens();
  const [spec, setSpec] = useState<Spec>();
  const [filters, setFilters] = useState<FilterState>();
  const [defaults, setDefaults] = useState<FilterState>();
  const [error, setError] = useState<string>();
  const [plaza, setPlaza] = useState<string | null>(null);
  const openPlaza = useCallback((name: string) => setPlaza(name), []);

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
  // The plaza popup's trend: the selected days, or on a retail-week report the last 8 weeks up to the selected one.
  const trendBase = useMemo(() => {
    if (!filters || !base) return undefined;
    const weeks = filters.weeks;
    const i = weeks?.findIndex((w) => w.week_start === filters.dateFrom) ?? -1;
    if (weeks && i >= 0) {
      const first = weeks[Math.max(0, i - 7)];
      return { ...base, dateFrom: first.week_start, dateTo: filters.dateTo, label: i === 0 ? 'the selected week' : `the ${Math.min(8, i + 1)} weeks up to the selected one` };
    }
    return { ...base, label: 'selected days' };
  }, [filters, base]);

  if (error) return <Container sx={{ py: 4 }}><Alert severity="error">{error}</Alert></Container>;
  if (!spec || !filters || !base || !defaults || !trendBase) {
    return <Box sx={{ display: 'grid', placeItems: 'center', py: 12 }}><CircularProgress thickness={2.5} size={46} /></Box>;
  }

  // Where the rows come from: green live DEV data, blue DEV export, orange made-up sample rows (the dot next to the dates).
  const source = spec.dataSource ?? listedSource;
  const colour = sourceColour(source, tokens);
  // Made-up rows keep one compact orange line, so nobody takes sample numbers for real ones. A DEV export shows no banner.
  // (Live mode only sends a notice when the backend itself runs on sample rows.)
  const warn = !!spec.sampleDataNotice && source !== 'export';
  const rangeLabel = weekLabel(filters) ?? formatRange(filters.dateFrom, filters.dateTo);
  const hasPlaza = !!spec.dimensions[PLAZA_DIM];
  const plazaFilter = spec.filters.some((f) => f.dimension === PLAZA_DIM && f.type === 'multi_select');
  return (
    <PlazaContext.Provider value={hasPlaza ? openPlaza : null}>
    <Container maxWidth={false} sx={{ py: 2, maxWidth: 1500 }}>
      <ReportHeader
        entry={entry}
        subtitle={spec.subtitle}
        right={(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: tokens.textSecondary, fontSize: '0.8rem', fontFamily: tokens.mono }}>
            <Box
              sx={{
                width: 8, height: 8, borderRadius: '50%', bgcolor: colour, boxShadow: `0 0 10px ${colour}`,
                animation: 'pulse 2s ease-in-out infinite',
                '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
              }}
            />
            {rangeLabel}
          </Box>
        )}
      />
      {warn && (
        <Tooltip title={spec.sampleDataNotice} placement="bottom-start">
          <Box
            role="alert"
            data-source={source}
            sx={{
              mb: 1.25, px: 1.25, py: 0.5, display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, borderRadius: '10px',
              border: `1px solid ${alpha(SAMPLE_ORANGE, 0.85)}`, bgcolor: alpha(SAMPLE_ORANGE, 0.14), boxShadow: `0 0 18px -8px ${SAMPLE_ORANGE}`,
              fontSize: '0.8rem', color: tokens.textSecondary,
            }}
          >
            <WarningAmberRoundedIcon sx={{ fontSize: 16, color: SAMPLE_ORANGE, flexShrink: 0 }} />
            <Typography component="div" noWrap sx={{ fontSize: 'inherit', minWidth: 0 }}>
              <strong style={{ color: SAMPLE_ORANGE }}>{SOURCE_LABEL.sample}.</strong> <span>{spec.sampleDataNotice}</span>
            </Typography>
          </Box>
        </Tooltip>
      )}

      <FilterBar reportId={reportId} spec={spec} value={filters} onChange={setFilters} onReset={() => setFilters(defaults)} />

      {/* Every visual in the order the settings file lists them, on a 12-column grid (one column on phones). */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 1.5, alignItems: 'stretch' }}>
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
      {hasPlaza && (
        <PlazaDetail
          reportId={reportId}
          spec={spec}
          base={base}
          trendBase={trendBase}
          rangeLabel={rangeLabel}
          plaza={plaza}
          onClose={() => setPlaza(null)}
          onFilter={plazaFilter ? (name) => setFilters({ ...filters, values: { ...filters.values, [PLAZA_DIM]: [name] } }) : undefined}
        />
      )}
    </Container>
    </PlazaContext.Provider>
  );
}

/** "Period 9 · Week 37" when a retail week is selected. */
function weekLabel(f: FilterState): string | null {
  const w = f.weeks?.find((x) => x.week_start === f.dateFrom && x.week_end === f.dateTo);
  return w ? `${w.retail_year} · Period ${w.retail_period} · Week ${w.retail_week}` : null;
}
