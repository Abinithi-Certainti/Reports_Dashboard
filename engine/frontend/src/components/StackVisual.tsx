import ReactECharts from 'echarts-for-react';
import { Box, Paper, Skeleton, Typography } from '@mui/material';
import { QueryRequest, Spec, Visual } from '../api';
import { formatCompactCurrency, formatValue } from '../format';
import { useQuery } from '../useQuery';
import { chartTheme, useTokens } from '../theme';

type Base = Omit<QueryRequest, 'measures'>;

/**
 * One horizontal bar per row (e.g. plaza), made of the `values` stacked end to end, so each bar shows what its
 * total is made of. A negative part (e.g. a variance below zero) is drawn to the left of zero.
 */
export default function StackVisual({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  const t = useTokens();
  const c = chartTheme(t);
  const dim = visual.rows?.[0] ?? '';
  const measures = visual.values ?? [];
  const { rows, error } = useQuery(reportId, { ...base, groupBy: [dim], measures });
  const format = spec.measures[measures[0]]?.format;
  const colours = [c.series1, '#f59e0b', t.bad, t.accent2, t.accent];

  const option = rows && {
    grid: { left: 8, right: 24, top: 30, bottom: 8, containLabel: true },
    legend: { top: 0, textStyle: { color: c.axisText } },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...c.tooltip,
      formatter: (ps: { name: string; seriesName: string; value: number; color: string }[]) =>
        `<b>${ps[0]?.name}</b><br/>${ps.map((p) => `<span style="color:${p.color}">●</span> ${p.seriesName}: <b>${formatValue(p.value, format)}</b>`).join('<br/>')}`,
    },
    xAxis: { type: 'value', axisLabel: { color: c.axisText, formatter: (v: number) => formatCompactCurrency(v) }, splitLine: { lineStyle: { color: c.grid } } },
    yAxis: {
      type: 'category', inverse: true, data: rows.map((r) => String(r[dim] ?? '(Blank)')),
      axisTick: { show: false }, axisLine: { lineStyle: { color: c.grid } }, axisLabel: { color: c.axisText },
    },
    series: measures.map((m, i) => ({
      type: 'bar', stack: 'parts', name: spec.measures[m]?.label ?? m, barMaxWidth: 18,
      data: rows.map((r) => Number(r[m] ?? 0)),
      itemStyle: { color: colours[i % colours.length], borderRadius: i === measures.length - 1 ? [0, 8, 8, 0] : 0 },
      emphasis: { focus: 'series' },
      animationDuration: 900, animationDelay: (j: number) => j * 60 + i * 150,
    })),
  };

  const minHeight = rows ? Math.max(240, rows.length * 28 + 40) : 260;
  return (
    <Paper sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h2" sx={{ mb: 1 }}>{visual.title}</Typography>
      {error && <Typography color="error">{error}</Typography>}
      <Box sx={{ flex: 1, minHeight, position: 'relative' }}>
        {option
          ? <ReactECharts option={option} style={{ position: 'absolute', inset: 0, height: '100%' }} notMerge />
          : <Skeleton variant="rectangular" height="100%" />}
      </Box>
    </Paper>
  );
}
