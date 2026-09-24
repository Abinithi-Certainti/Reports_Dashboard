import ReactECharts from 'echarts-for-react';
import { Box, Paper, Skeleton, Typography } from '@mui/material';
import { KpiItem, QueryRequest, Spec, Visual } from '../api';
import { useQuery } from '../useQuery';
import { formatDay, formatValue } from '../format';
import { tokens } from '../theme';
import AnimatedNumber from './AnimatedNumber';

type Base = Omit<QueryRequest, 'measures'>;

/** A KPI's own include list narrows the user's filter (intersection); its exclude list is added on top. */
function requestFor(item: KpiItem, base: Base, groupBy: string[]): QueryRequest | null {
  const filters: Record<string, string[]> = { ...(base.filters ?? {}) };
  for (const [dim, only] of Object.entries(item.include ?? {})) {
    const chosen = filters[dim] ?? [];
    const narrowed = chosen.length ? chosen.filter((v) => only.includes(v)) : only;
    if (narrowed.length === 0) return null; // the user filtered this slice out entirely
    filters[dim] = narrowed;
  }
  return { ...base, filters, exclude: item.exclude, groupBy, measures: [item.measure] };
}

function Sparkline({ rows, measure, dateDim, format }: { rows: Record<string, unknown>[]; measure: string; dateDim: string; format?: string | null }) {
  const option = {
    grid: { left: 0, right: 0, top: 4, bottom: 0 },
    xAxis: { type: 'category', show: false, data: rows.map((r) => String(r[dateDim])) },
    yAxis: { type: 'value', show: false, scale: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0f1623',
      borderColor: tokens.panelBorder,
      textStyle: { color: tokens.textPrimary, fontSize: 12 },
      formatter: (p: { name: string; value: number }[]) => `${formatDay(p[0].name)}<br/><b>${formatValue(p[0].value, format)}</b>`,
    },
    series: [
      {
        type: 'line',
        data: rows.map((r) => Number(r[measure] ?? 0)),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: tokens.accent },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(56,189,248,0.28)' }, { offset: 1, color: 'rgba(56,189,248,0)' }],
          },
        },
      },
    ],
  };
  return <ReactECharts option={option} style={{ height: 46 }} notMerge />;
}

function Tile({ reportId, spec, item, base, index }: { reportId: string; spec: Spec; item: KpiItem; base: Base; index: number }) {
  const dateDim = Object.entries(spec.dimensions).find(([, d]) => d.type === 'date')?.[0];
  const request = requestFor(item, base, []);
  const trendRequest = dateDim ? requestFor(item, base, [dateDim]) : null;
  const { rows, error } = useQuery(reportId, request);
  const trend = useQuery(reportId, trendRequest);
  const format = spec.measures[item.measure]?.format;
  const value = request === null ? 0 : rows?.[0]?.[item.measure];

  return (
    <Paper
      sx={{
        p: 2.25, pb: 1, position: 'relative', overflow: 'hidden',
        animation: 'rise .6s ease both', animationDelay: `${index * 80}ms`,
        '@keyframes rise': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'none' } },
        '&::before': {
          content: '""', position: 'absolute', inset: '0 0 auto 0', height: 2,
          background: `linear-gradient(90deg, transparent, ${tokens.accent}, transparent)`, opacity: 0.8,
        },
      }}
    >
      <Typography variant="h2" sx={{ fontSize: '0.7rem' }}>{item.label}</Typography>
      {error ? (
        <Typography color="error" variant="body2">{error}</Typography>
      ) : value === undefined ? (
        <Skeleton width="60%" height={44} />
      ) : (
        <Typography
          sx={{
            fontFamily: tokens.mono, fontSize: { xs: '1.35rem', md: '1.75rem' }, fontWeight: 600, mt: 0.5, color: tokens.textPrimary,
            textShadow: '0 0 24px rgba(56,189,248,0.35)', whiteSpace: 'nowrap',
          }}
        >
          <AnimatedNumber value={Number(value ?? 0)} format={format} />
        </Typography>
      )}
      <Box sx={{ mx: -2.25, mt: 0.5 }}>
        {dateDim && trend.rows && trend.rows.length > 1 && (
          <Sparkline rows={trend.rows} measure={item.measure} dateDim={dateDim} format={format} />
        )}
      </Box>
    </Paper>
  );
}

export default function KpiRow({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: `repeat(${visual.items?.length ?? 1}, 1fr)` }, gap: 2, mb: 2 }}>
      {visual.items?.map((item, i) => <Tile key={item.label} index={i} reportId={reportId} spec={spec} item={item} base={base} />)}
    </Box>
  );
}
