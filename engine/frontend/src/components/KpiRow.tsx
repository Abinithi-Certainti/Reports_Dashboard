import ReactECharts from 'echarts-for-react';
import { Box, Paper, Skeleton, Tooltip, Typography } from '@mui/material';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import { KpiItem, QueryRequest, Spec, Visual } from '../api';
import { useQuery } from '../useQuery';
import { addDays, formatDay, formatValue } from '../format';
import { chartTheme, useTokens } from '../theme';
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

/** The same number of days immediately before the chosen range. */
function previousPeriod(base: Base): Base | null {
  if (!base.dateFrom || !base.dateTo) return null;
  const days = Math.round((Date.parse(base.dateTo) - Date.parse(base.dateFrom)) / 86_400_000) + 1;
  return { ...base, dateFrom: addDays(base.dateFrom, -days), dateTo: addDays(base.dateFrom, -1) };
}

function Sparkline({ rows, measure, dateDim, format }: { rows: Record<string, unknown>[]; measure: string; dateDim: string; format?: string | null }) {
  const t = useTokens();
  const c = chartTheme(t);
  const option = {
    grid: { left: 0, right: 0, top: 4, bottom: 0 },
    xAxis: { type: 'category', show: false, data: rows.map((r) => String(r[dateDim])) },
    yAxis: { type: 'value', show: false, scale: true },
    tooltip: {
      trigger: 'axis',
      ...c.tooltip,
      formatter: (p: { name: string; value: number }[]) => `${formatDay(p[0].name)}<br/><b>${formatValue(p[0].value, format)}</b>`,
    },
    series: [
      {
        type: 'line',
        data: rows.map((r) => Number(r[measure] ?? 0)),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: c.series1Light },
        areaStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: `${c.series1Light}47` }, { offset: 1, color: `${c.series1Light}00` }] },
        },
      },
    ],
  };
  return <ReactECharts option={option} style={{ height: 46 }} notMerge />;
}

function Tile({ reportId, spec, item, base, index }: { reportId: string; spec: Spec; item: KpiItem; base: Base; index: number }) {
  const t = useTokens();
  const dateDim = Object.entries(spec.dimensions).find(([, d]) => d.type === 'date')?.[0];
  const prevBase = previousPeriod(base);
  const request = requestFor(item, base, []);
  const prevRequest = prevBase ? requestFor(item, prevBase, []) : null;
  const trendRequest = dateDim ? requestFor(item, base, [dateDim]) : null;
  const { rows, error } = useQuery(reportId, request);
  const prev = useQuery(reportId, prevRequest);
  const trend = useQuery(reportId, trendRequest);
  const format = spec.measures[item.measure]?.format;
  const value = request === null ? 0 : rows?.[0]?.[item.measure];
  const prevValue = Number(prev.rows?.[0]?.[item.measure] ?? 0);

  let delta: { pct: number; good: boolean } | null = null;
  if (value !== undefined && prev.rows && prevValue > 0) {
    const pct = (Number(value ?? 0) - prevValue) / prevValue;
    const goodWhenUp = (item.good_direction ?? 'up') === 'up';
    delta = { pct, good: pct === 0 ? true : pct > 0 === goodWhenUp };
  }

  return (
    <Paper
      sx={{
        p: 2.25, pb: 1, position: 'relative', overflow: 'hidden',
        animation: 'rise .6s ease both', animationDelay: `${index * 80}ms`,
        '@keyframes rise': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'none' } },
        '&::before': t.glow
          ? { content: '""', position: 'absolute', inset: '0 0 auto 0', height: 2, background: `linear-gradient(90deg, transparent, ${t.accent}, transparent)`, opacity: 0.8 }
          : {},
        '&:hover': { transform: 'translateY(-2px)' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="h2" sx={{ fontSize: '0.68rem' }}>{item.label}</Typography>
        {delta && (
          <Tooltip title={`vs the previous ${prevBase ? Math.round((Date.parse(base.dateTo!) - Date.parse(base.dateFrom!)) / 86_400_000) + 1 : ''} days (${formatValue(prevValue, format)})`}>
            <Box
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.25, px: 0.75, py: 0.15, borderRadius: '8px', fontSize: '0.72rem', fontWeight: 650,
                fontFamily: t.mono, color: delta.good ? t.good : t.bad, bgcolor: `${delta.good ? t.good : t.bad}1f`,
              }}
            >
              {delta.pct >= 0 ? <ArrowUpwardRoundedIcon sx={{ fontSize: 13 }} /> : <ArrowDownwardRoundedIcon sx={{ fontSize: 13 }} />}
              {Math.abs(delta.pct * 100).toFixed(1)}%
            </Box>
          </Tooltip>
        )}
      </Box>
      {error ? (
        <Typography color="error" variant="body2">{error}</Typography>
      ) : value === undefined ? (
        <Skeleton width="60%" height={44} />
      ) : (
        <Typography
          sx={{
            fontFamily: t.mono, fontSize: { xs: '1.3rem', md: '1.7rem' }, fontWeight: 650, mt: 0.5, color: t.textPrimary,
            textShadow: t.glow ? `0 0 24px ${t.glow}` : 'none', whiteSpace: 'nowrap',
          }}
        >
          <AnimatedNumber value={Number(value ?? 0)} format={format} />
        </Typography>
      )}
      <Typography sx={{ fontSize: '0.7rem', color: t.textMuted, minHeight: 16 }}>{delta ? 'vs previous period' : ' '}</Typography>
      <Box sx={{ mx: -2.25, mt: 0.25 }}>
        {dateDim && trend.rows && trend.rows.length > 1 && <Sparkline rows={trend.rows} measure={item.measure} dateDim={dateDim} format={format} />}
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
