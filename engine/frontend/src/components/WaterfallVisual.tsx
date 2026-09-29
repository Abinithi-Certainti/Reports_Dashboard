import ReactECharts from 'echarts-for-react';
import { Box, Paper, Skeleton, Typography } from '@mui/material';
import { QueryRequest, Spec, Visual } from '../api';
import { formatCompactCurrency, formatValue } from '../format';
import { useQuery } from '../useQuery';
import { chartTheme, useTokens } from '../theme';

type Base = Omit<QueryRequest, 'measures'>;

/**
 * A running total from a start value to an end value: `values` are the steps, `signs` says whether each step adds
 * (+) or takes away (-), and `total` is the measure the steps should arrive at. When the steps do not add up to the
 * total, the gap is shown as its own "Other adjustments" bar, never hidden.
 */
export default function WaterfallVisual({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  const t = useTokens();
  const c = chartTheme(t);
  const steps = visual.values ?? [];
  const signs = visual.signs ?? steps.map(() => '+');
  const total = visual.total ?? null;
  const measures = total ? [...steps, total] : steps;
  const { rows, error } = useQuery(reportId, { ...base, groupBy: [], measures });
  const format = spec.measures[steps[0]]?.format;
  const r = rows?.[0];

  type Bar = { label: string; from: number; to: number; kind: 'start' | 'up' | 'down' | 'gap' | 'total' };
  const bars: Bar[] = [];
  if (r) {
    let run = 0;
    steps.forEach((m, i) => {
      const v = Number(r[m] ?? 0);
      const label = spec.measures[m]?.label ?? m;
      if (i === 0) { bars.push({ label, from: 0, to: v, kind: 'start' }); run = v; return; }
      const next = signs[i] === '-' ? run - v : run + v;
      bars.push({ label: `${signs[i] === '-' ? '− ' : '+ '}${label}`, from: run, to: next, kind: signs[i] === '-' ? 'down' : 'up' });
      run = next;
    });
    if (total) {
      const end = Number(r[total] ?? 0);
      if (Math.abs(end - run) >= 0.5) bars.push({ label: 'Other adjustments', from: run, to: end, kind: 'gap' });
      bars.push({ label: `= ${spec.measures[total]?.label ?? total}`, from: 0, to: end, kind: 'total' });
    }
  }
  const colour = (k: Bar['kind']) => (k === 'up' ? t.accent : k === 'down' ? t.bad : k === 'gap' ? '#f59e0b' : k === 'total' ? t.accent2 : c.series1);

  const option = r && {
    grid: { left: 8, right: 16, top: 26, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'item', ...c.tooltip,
      formatter: (p: { dataIndex: number }) => {
        const b = bars[p.dataIndex];
        return `${b.label}<br/><b>${formatValue(Math.abs(b.to - b.from), format)}</b>`;
      },
    },
    xAxis: {
      type: 'category', data: bars.map((b) => b.label),
      axisLabel: { color: c.axisText, interval: 0, fontSize: 11 }, axisTick: { show: false }, axisLine: { lineStyle: { color: c.grid } },
    },
    yAxis: { type: 'value', axisLabel: { color: c.axisText, formatter: (v: number) => formatCompactCurrency(v) }, splitLine: { lineStyle: { color: c.grid } } },
    series: [
      // An invisible base lifts each bar to where the running total stands.
      { type: 'bar', stack: 'w', silent: true, itemStyle: { color: 'transparent' }, data: bars.map((b) => Math.min(b.from, b.to)) },
      {
        type: 'bar', stack: 'w', barMaxWidth: 64,
        data: bars.map((b) => ({ value: Math.abs(b.to - b.from), itemStyle: { color: colour(b.kind), borderRadius: 6, shadowBlur: t.glow ? 10 : 0, shadowColor: t.glow || 'transparent' } })),
        label: {
          show: true, position: 'top', color: t.textPrimary, fontFamily: t.mono, fontSize: 11,
          formatter: (p: { dataIndex: number }) => formatCompactCurrency(bars[p.dataIndex].to - bars[p.dataIndex].from),
        },
        animationDuration: 1000, animationEasing: 'cubicOut', animationDelay: (i: number) => i * 120,
      },
    ],
  };

  return (
    <Paper sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h2" sx={{ mb: 1 }}>{visual.title}</Typography>
      {error && <Typography color="error">{error}</Typography>}
      <Box sx={{ flex: 1, minHeight: 260, position: 'relative' }}>
        {option
          ? <ReactECharts option={option} style={{ position: 'absolute', inset: 0, height: '100%' }} notMerge />
          : <Skeleton variant="rectangular" height="100%" />}
      </Box>
    </Paper>
  );
}
