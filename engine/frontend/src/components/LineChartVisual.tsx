import ReactECharts from 'echarts-for-react';
import { Box, Paper, Skeleton, Typography } from '@mui/material';
import { QueryRequest, Spec, Visual } from '../api';
import { formatCompactCurrency, formatDay, formatValue } from '../format';
import { useQuery } from '../useQuery';
import { chartTheme, useTokens } from '../theme';

type Base = Omit<QueryRequest, 'measures'>;

/**
 * One measure over the date dimension: 2px line, light area wash, crosshair tooltip. An optional second value
 * (e.g. last year or the budget) is drawn as a dashed comparison line, and the tooltip shows the gap between them.
 */
export default function LineChartVisual({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  const t = useTokens();
  const c = chartTheme(t);
  const dim = visual.rows?.[0] ?? '';
  const measure = visual.values?.[0] ?? '';
  const compare = visual.values?.[1];
  const format = spec.measures[measure]?.format;
  const { rows, error } = useQuery(reportId, { ...base, groupBy: [dim], measures: compare ? [measure, compare] : [measure] });
  const label = (m: string) => spec.measures[m]?.label ?? m;
  const isDate = spec.dimensions[dim]?.type === 'date';
  const dayText = (v: string) => (isDate ? formatDay(v) : v);

  const option = rows && {
    grid: { left: 8, right: 16, top: compare ? 30 : 16, bottom: 4, containLabel: true },
    ...(compare ? { legend: { top: 0, textStyle: { color: c.axisText }, data: [label(measure), label(compare)] } } : {}),
    tooltip: {
      trigger: 'axis',
      ...c.tooltip,
      axisPointer: { type: 'line', lineStyle: { color: t.textMuted, width: 1 } },
      formatter: (p: { name: string; value: number | null }[]) => {
        const a = p[0]?.value ?? null;
        const b = compare ? p[1]?.value ?? null : null;
        const gap = compare && a !== null && b !== null && b !== 0 ? ` (${a >= b ? '+' : ''}${(((a - b) / Math.abs(b)) * 100).toFixed(1)}%)` : '';
        return `${dayText(p[0].name)}<br/>${label(measure)}: <b>${formatValue(a, format)}</b>${compare ? `<br/>${label(compare)}: ${formatValue(b, format)}${gap}` : ''}`;
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: rows.map((r) => String(r[dim])),
      axisLabel: { color: c.axisText, formatter: (v: string) => dayText(v).replace(/^\w+, /, '') },
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
        name: label(measure),
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
      ...(compare ? [{
        type: 'line', name: label(compare), smooth: 0.35, showSymbol: false, z: 1,
        data: rows.map((r) => (r[compare] == null ? null : Number(r[compare]))),
        lineStyle: { width: 2, type: 'dashed', color: t.textMuted },
        itemStyle: { color: t.textMuted },
        animationDuration: 1600,
      }] : []),
    ],
  };

  return (
    <Paper sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h2" sx={{ mb: 1 }}>{visual.title}</Typography>
      {error && <Typography color="error">{error}</Typography>}
      {/* Grows to the height of its row (for example next to a donut), never below 240px. */}
      <Box sx={{ flex: 1, minHeight: 240, position: 'relative' }}>
        {option
          ? <ReactECharts option={option} style={{ position: 'absolute', inset: 0, height: '100%' }} notMerge />
          : <Skeleton variant="rectangular" height="100%" />}
      </Box>
    </Paper>
  );
}
