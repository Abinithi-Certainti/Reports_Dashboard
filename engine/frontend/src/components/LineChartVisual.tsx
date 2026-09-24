import ReactECharts from 'echarts-for-react';
import { Paper, Skeleton, Typography } from '@mui/material';
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
        lineStyle: { width: 2, color: c.series1Light, shadowColor: t.glow || 'transparent', shadowBlur: t.glow ? 10 : 0 },
        itemStyle: { color: c.series1Light, borderColor: t.panelSolid, borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: `${c.series1Light}40` }, { offset: 1, color: `${c.series1Light}00` }],
          },
        },
        animationDuration: 1100,
      },
    ],
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h2" sx={{ mb: 1 }}>{visual.title}</Typography>
      {error && <Typography color="error">{error}</Typography>}
      {option ? <ReactECharts option={option} style={{ height: 240 }} notMerge /> : <Skeleton variant="rectangular" height={240} />}
    </Paper>
  );
}
