import ReactECharts from 'echarts-for-react';
import { Box, Paper, Skeleton, Typography } from '@mui/material';
import { QueryRequest, Spec, Visual } from '../api';
import { formatCompactCurrency, formatValue } from '../format';
import { useQuery } from '../useQuery';
import { chartTheme, useTokens } from '../theme';
import { PLAZA_DIM, usePlazaOpener } from './PlazaDetail';

type Base = Omit<QueryRequest, 'measures'>;

/** Horizontal bars (long category names read better), in the spec's sort order top to bottom. Several values sit side by side. */
export default function BarChartVisual({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  const tokens = useTokens();
  const chartColors = chartTheme(tokens);
  const dim = visual.rows?.[0] ?? '';
  const measures = visual.values?.length ? visual.values : [''];
  const { rows, error } = useQuery(reportId, { ...base, groupBy: [dim], measures });
  const format = spec.measures[measures[0]]?.format;
  const many = measures.length > 1;
  const signed = !many && (rows ?? []).some((r) => Number(r[measures[0]] ?? 0) < 0);
  // Bars (and their labels) of a plaza chart open the plaza popup.
  const openPlaza = usePlazaOpener();
  const clickable = dim === PLAZA_DIM && !!openPlaza;
  const onEvents = clickable ? {
    click: (p: { componentType: string; name?: string; value?: unknown }) => {
      const name = p.componentType === 'yAxis' ? String(p.value) : p.name;
      if (name && name !== '(Blank)') openPlaza!(name);
    },
  } : undefined;

  const option = rows && {
    grid: { left: 8, right: 64, top: many ? 32 : 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'item',
      ...chartColors.tooltip,
      formatter: (p: { name: string; value: number; seriesName: string }) =>
        `${p.name}${many ? ` · ${p.seriesName}` : ''}<br/><b>${formatValue(p.value, format)}</b>`,
    },
    legend: many ? { top: 0, textStyle: { color: chartColors.axisText } } : undefined,
    xAxis: {
      type: 'value',
      axisLabel: { color: chartColors.axisText, formatter: (v: number) => formatCompactCurrency(v) },
      splitLine: { lineStyle: { color: chartColors.grid, width: 1, type: 'solid' } },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: rows.map((r) => String(r[dim] ?? '(Blank)')),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: chartColors.grid } },
      axisLabel: { color: chartColors.axisText },
      triggerEvent: clickable,
    },
    series: measures.map((measure, i) => ({
        type: 'bar',
        name: spec.measures[measure]?.label ?? measure,
        // One value that goes below zero (e.g. a variance): green above zero, red below, so it reads as above / below.
        data: rows.map((r) => {
          const v = Number(r[measure] ?? 0);
          return signed ? { value: v, itemStyle: { color: v >= 0 ? tokens.good : tokens.bad, borderRadius: 9 } } : v;
        }),
        barMaxWidth: 18,
        cursor: clickable ? 'pointer' : 'default',
        showBackground: true,
        backgroundStyle: { color: tokens.mode === 'light' ? 'rgba(15,23,42,0.035)' : 'rgba(148,163,184,0.06)', borderRadius: 9 },
        itemStyle: {
          borderRadius: 9,
          // The first value keeps the gradient; any further ones take the next colours of the palette.
          color: i === 0 ? { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [
            { offset: 0, color: chartColors.series1 }, { offset: 0.7, color: chartColors.series1Light }, { offset: 1, color: tokens.accent2 }] }
            : tokens.palette[i % tokens.palette.length],
          shadowColor: tokens.glow || 'transparent', shadowBlur: tokens.glow ? 10 : 0,
        },
        animationDuration: 1000,
        animationEasing: 'cubicOut',
        animationDelay: (i: number) => i * 70, // bars grow one after another
        label: {
          show: true,
          position: 'right',
          color: tokens.textPrimary,
          fontFamily: tokens.mono,
          fontSize: 11,
          formatter: (p: { value: number }) => formatCompactCurrency(p.value),
        },
        emphasis: { itemStyle: { shadowBlur: 16, shadowColor: tokens.glow || 'rgba(42,120,214,0.35)' } },
      })),
  };

  // The chart needs this much room for its bars; next to a taller panel it grows to fill the same height.
  const minHeight = rows ? Math.max(220, rows.length * (many ? 26 * measures.length : 30) + (many ? 32 : 0)) : 240;
  return (
    <Paper sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <Typography variant="h2">{visual.title}</Typography>
        {clickable && <Typography sx={{ fontSize: '0.72rem', color: tokens.textMuted }}>Click a plaza for its details</Typography>}
      </Box>
      {error && <Typography color="error">{error}</Typography>}
      <Box sx={{ flex: 1, minHeight, position: 'relative' }}>
        {option
          ? <ReactECharts option={option} onEvents={onEvents} style={{ position: 'absolute', inset: 0, height: '100%' }} notMerge />
          : <Skeleton variant="rectangular" height="100%" />}
      </Box>
    </Paper>
  );
}
