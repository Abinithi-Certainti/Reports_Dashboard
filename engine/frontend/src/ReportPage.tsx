import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, CircularProgress, Container, Typography } from '@mui/material';
import { useTokens } from './theme';
import { api, QueryRequest, Spec } from './api';
import { addDays } from './format';
import FilterBar, { FilterState } from './components/FilterBar';
import KpiRow from './components/KpiRow';
import SummaryTable from './components/SummaryTable';
import BarChartVisual from './components/BarChartVisual';
import MatrixVisual from './components/MatrixVisual';
import LineChartVisual from './components/LineChartVisual';

/** Draws any report from its spec: the filter bar on top, then each visual in order. */
export default function ReportPage({ reportId }: { reportId: string }) {
  const tokens = useTokens();
  const [spec, setSpec] = useState<Spec>();
  const [filters, setFilters] = useState<FilterState>();
  const [defaults, setDefaults] = useState<FilterState>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    setSpec(undefined);
    setError(undefined);
    Promise.all([api.spec(reportId), api.dateBounds(reportId)])
      .then(([s, bounds]) => {
        const dateFilter = s.filters.find((f) => f.type === 'date_range');
        const days = dateFilter?.default_last_days ?? 30;
        const initial: FilterState = {
          values: {},
          dateFrom: addDays(bounds.max_date, -(days - 1)) < bounds.min_date ? bounds.min_date : addDays(bounds.max_date, -(days - 1)),
          dateTo: bounds.max_date,
          minDate: bounds.min_date,
          maxDate: bounds.max_date,
        };
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
    return <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}><CircularProgress /></Box>;
  }

  const tables = spec.visuals.filter((v) => v.type === 'table');
  const bars = spec.visuals.filter((v) => v.type === 'bar');

  return (
    <Container maxWidth={false} sx={{ py: 3, maxWidth: 1500 }}>
      <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography
            variant="h1"
            sx={{
              background: `linear-gradient(90deg, ${tokens.textPrimary} 30%, ${tokens.accent})`,
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            }}
          >
            {spec.title}
          </Typography>
          {spec.subtitle && <Typography sx={{ color: tokens.textSecondary }}>{spec.subtitle}</Typography>}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: tokens.textSecondary, fontSize: '0.8rem', fontFamily: tokens.mono }}>
          <Box
            sx={{
              width: 8, height: 8, borderRadius: '50%', bgcolor: tokens.good, boxShadow: `0 0 10px ${tokens.good}`,
              animation: 'pulse 2s ease-in-out infinite',
              '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
            }}
          />
          {filters.dateFrom} → {filters.dateTo}
        </Box>
      </Box>
      {spec.sampleDataNotice && (
        <Alert
          severity="warning"
          variant="outlined"
          sx={{ mb: 2, bgcolor: 'rgba(251,191,36,0.08)', borderColor: 'rgba(245,158,11,0.45)', color: tokens.mode === 'light' ? '#92400e' : '#fde68a' }}
        >
          <strong>Sample data.</strong> {spec.sampleDataNotice}
        </Alert>
      )}

      <FilterBar reportId={reportId} spec={spec} value={filters} onChange={setFilters} onReset={() => setFilters(defaults)} />

      {spec.visuals
        .filter((v) => v.type === 'kpi')
        .map((v, i) => <KpiRow key={`kpi-${i}`} reportId={reportId} spec={spec} visual={v} base={base} />)}

      {spec.visuals
        .filter((v) => v.type === 'line')
        .map((v, i) => <Box key={`l-${i}`} sx={{ mb: 2 }}><LineChartVisual reportId={reportId} spec={spec} visual={v} base={base} /></Box>)}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: tables.length && bars.length ? '5fr 7fr' : '1fr' }, gap: 2, mb: 2 }}>
        {tables.map((v, i) => <SummaryTable key={`t-${i}`} reportId={reportId} spec={spec} visual={v} base={base} />)}
        {bars.map((v, i) => <BarChartVisual key={`b-${i}`} reportId={reportId} spec={spec} visual={v} base={base} />)}
      </Box>

      {spec.visuals
        .filter((v) => v.type === 'matrix')
        .map((v, i) => <MatrixVisual key={`m-${i}`} reportId={reportId} spec={spec} visual={v} base={base} />)}
    </Container>
  );
}
