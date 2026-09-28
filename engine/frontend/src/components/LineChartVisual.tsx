import ReactECharts from 'echarts-for-react';
import { Box, Paper, Skeleton, Typography } from '@mui/material';
import { QueryRequest, Spec, Visual } from '../api';
import { formatCompactCurrency, formatDay, formatValue } from '../format';
import { useQuery } from '../useQuery';
import { chartTheme, useTokens } from '../theme';

type Base = Omit<QueryRequest, 'measures'>;

/** One measure over the date dimension: 2px line, light area wash, crosshair tooltip. */
export default function LineChartVisual({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  const t = useTokens();
  const c = chartTheme(t);
  const dim = visual.rows?.[0] ?? '';
  const measure = visual.values?.[0] ?? '';
  const format = spec.measures[measure]?.format;
  const { rows, error } = useQuery(reportId, { ...base, groupBy: [dim], measures: [measure] });

  const option = rows && {
    grid: { left: 8, right: 16, top: 16, bottom: 4, containLabel: true },
    tooltip: {
      trigger: 'axis',
      ...c.tooltip,
      axisPointer: { type: 'line', lineStyle: { color: t.textMuted, width: 1 } },
      formatter: (p: { name: string; value: number }[]) => `${formatDay(p[0].name)}<br/><b>${formatValue(p[0].value, format)}</b>`,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: rows.map((r) => String(r[dim])),
      axisLabel: { color: c.axisText, formatter: (v: string) => formatDay(v).replace(/^\w+, /, '') },
      axisLine: { lineStyle: { color: c.grid } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: c.axisText, formatter: (v: number) => (format === 'currency' ? formatCompactCurrency(v) : String(v)) },
      splitLine: { lineStyle: { color: c.grid } },
    },
    series: [
      {
        type: 'line',
        data: rows.map((r) => Number(r[measure] ?? 0)),
        smooth: 0.35,
        showSymbol: false,
        symbolSize: 8,
        lineStyle: {
          width: 2.5, shadowColor: t.glow || 'transparent', shadowBlur: t.glow ? 12 : 0,
          color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: c.series1Light }, { offset: 1, color: t.accent2 }] },
        },
        emphasis: { focus: 'series', scale: 1.6 },
        // A dashed average line, so good and bad days stand out.
        markLine: {
          silent: true, symbol: 'none',
          lineStyle: { type: 'dashed', color: t.textMuted, width: 1 },
          label: { position: 'insideEndTop', color: t.textSecondary, fontFamily: t.mono, fontSize: 10, formatter: (p: { value: number }) => `avg ${format === 'currency' ? formatCompactCurrency(p.value) : formatValue(Math.round(p.value), format)}` },
          data: [{ type: 'average' }],
        },
        itemStyle: { color: t.accent, borderColor: t.panelSolid, borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: `${c.series1Light}40` }, { offset: 1, color: `${c.series1Light}00` }],
          },
        },
        animationDuration: 1600,
        animationEasing: 'cubicOut',
      },
    ],
  };

  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h2" sx={{ mb: 1 }}>{visual.title}</Typography>
      {error && <Typography color="error">{error}</Typography>}
      {/* Grows to the height of its row (for example next to a donut), never below 260px. */}
      <Box sx={{ flex: 1, minHeight: 260, position: 'relative' }}>
        {option
          ? <ReactECharts option={option} style={{ position: 'absolute', inset: 0, height: '100%' }} notMerge />
          : <Skeleton variant="rectangular" height="100%" />}
      </Box>
    </Paper>
  );
}
