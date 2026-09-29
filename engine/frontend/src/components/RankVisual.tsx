import ReactECharts from 'echarts-for-react';
import { Box, Paper, Skeleton, Typography } from '@mui/material';
import { QueryRequest, Spec, Visual } from '../api';
import { formatCompactCurrency, formatValue } from '../format';
import { useQuery } from '../useQuery';
import { chartTheme, useTokens } from '../theme';
import { usePlazaOpener } from './PlazaDetail';

type Base = Omit<QueryRequest, 'measures'>;

/**
 * A ranking as standing columns: one column per rows[0] (e.g. plaza) for values[0], largest on the left, its value on
 * top. The value is a cost-type number, so above zero is red (money lost) and below zero is green. values[1], when
 * given, is added to the tooltip (e.g. its % of COGS). Clicking a plaza column opens that plaza.
 */
export default function RankVisual({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  const t = useTokens();
  const c = chartTheme(t);
  const openPlaza = usePlazaOpener();
  const dim = visual.rows?.[0] ?? '';
  const [main, side] = visual.values ?? [];
  const { rows, error } = useQuery(reportId, { ...base, groupBy: [dim], measures: side ? [main, side] : [main] });
  const format = spec.measures[main]?.format;
  const sideFormat = side ? spec.measures[side]?.format : undefined;

  const items = (rows ?? []).map((r) => ({ name: String(r[dim] ?? '(Blank)'), v: Number(r[main] ?? 0), s: side && r[side] != null ? Number(r[side]) : null }))
    .sort((a, b) => b.v - a.v);
  const clickable = dim === 'plaza' && !!openPlaza;

  const option = rows && {
    grid: { left: 8, right: 8, top: 26, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' }, ...c.tooltip,
      formatter: (ps: { dataIndex: number }[]) => {
        const x = items[ps[0].dataIndex];
        return `<b>${x.name}</b><br/>${spec.measures[main]?.label}: <b>${formatValue(x.v, format)}</b>${x.s !== null ? `<br/>${spec.measures[side]?.label}: ${formatValue(x.s, sideFormat)}` : ''}`;
      },
    },
    xAxis: {
      type: 'category', data: items.map((x) => x.name), axisTick: { show: false }, axisLine: { lineStyle: { color: c.grid } },
      axisLabel: { color: c.axisText, interval: 0, rotate: items.length > 8 ? 40 : 0, fontSize: 11 },
    },
    yAxis: { type: 'value', axisLabel: { color: c.axisText, formatter: (v: number) => formatCompactCurrency(v) }, splitLine: { lineStyle: { color: c.grid } } },
    series: [{
      type: 'bar', barMaxWidth: 34, cursor: clickable ? 'pointer' : 'default',
      data: items.map((x) => ({ value: x.v, itemStyle: { color: x.v > 0 ? t.bad : t.good, borderRadius: x.v >= 0 ? [6, 6, 0, 0] : [0, 0, 6, 6] } })),
      label: {
        show: true, position: 'top', color: t.textPrimary, fontFamily: t.mono, fontSize: 10, fontWeight: 600,
        formatter: (p: { value: number }) => `${p.value > 0 ? '+' : ''}${formatCompactCurrency(p.value)}`,
      },
      labelLayout: { hideOverlap: true },
      animationDuration: 900, animationDelay: (i: number) => i * 40,
    }],
  };

  return (
    <Paper sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h2" sx={{ mb: 1 }}>{visual.title}</Typography>
      {error && <Typography color="error">{error}</Typography>}
      <Box sx={{ height: 340, position: 'relative' }}>
        {option
          ? <ReactECharts option={option} style={{ position: 'absolute', inset: 0, height: '100%' }} notMerge
              onEvents={{ click: (p: { dataIndex: number }) => { if (clickable) openPlaza!(items[p.dataIndex].name); } }} />
          : <Skeleton variant="rectangular" height="100%" />}
      </Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1, fontSize: '0.72rem', color: t.textSecondary }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Box sx={{ width: 12, height: 8, borderRadius: 2, bgcolor: t.bad }} />Above zero · money lost</Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Box sx={{ width: 12, height: 8, borderRadius: 2, bgcolor: t.good }} />Below zero · money saved</Box>
        {clickable && <span>Click a column to open the plaza.</span>}
      </Box>
    </Paper>
  );
}
