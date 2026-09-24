import ReactECharts from 'echarts-for-react';
import { Paper, Skeleton, Typography } from '@mui/material';
import { QueryRequest, Spec, Visual } from '../api';
import { formatCompactCurrency, formatValue } from '../format';
import { useQuery } from '../useQuery';
import { chartColors } from '../theme';

type Base = Omit<QueryRequest, 'measures'>;

/** One series, horizontal bars (long category names read better), in the spec's sort order top to bottom. */
export default function BarChartVisual({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  const dim = visual.rows?.[0] ?? '';
  const measure = visual.values?.[0] ?? '';
  const { rows, error } = useQuery(reportId, { ...base, groupBy: [dim], measures: [measure] });
  const format = spec.measures[measure]?.format;

  const option = rows && {
    grid: { left: 8, right: 64, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'item',
      formatter: (p: { name: string; value: number }) => `${p.name}<br/><b>${formatValue(p.value, format)}</b>`,
    },
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
    },
    series: [
      {
        type: 'bar',
        data: rows.map((r) => Number(r[measure] ?? 0)),
        barMaxWidth: 20,
        itemStyle: { color: chartColors.series1, borderRadius: [0, 4, 4, 0] },
        label: {
          show: true,
          position: 'right',
          color: chartColors.axisText,
          formatter: (p: { value: number }) => formatCompactCurrency(p.value),
        },
        emphasis: { itemStyle: { color: '#1f64b8' } },
      },
    ],
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h2" sx={{ mb: 1 }}>{visual.title}</Typography>
      {error && <Typography color="error">{error}</Typography>}
      {option ? (
        <ReactECharts option={option} style={{ height: Math.max(260, rows!.length * 34) }} notMerge />
      ) : (
        <Skeleton variant="rectangular" height={300} />
      )}
    </Paper>
  );
}
