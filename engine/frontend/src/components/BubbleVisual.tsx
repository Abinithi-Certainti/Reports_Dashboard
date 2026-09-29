import ReactECharts from 'echarts-for-react';
import { Box, Paper, Skeleton, Typography } from '@mui/material';
import { QueryRequest, Spec, Visual } from '../api';
import { formatCompactCurrency, formatValue } from '../format';
import { useQuery } from '../useQuery';
import { chartTheme, useTokens } from '../theme';
import { usePlazaOpener } from './PlazaDetail';

type Base = Omit<QueryRequest, 'measures'>;

/**
 * One bubble per rows[0] (e.g. plaza): values[0] across, values[1] up, values[2] (optional) the bubble size. Bubbles
 * above zero are red (the higher, the redder), below zero green, and a dashed line marks the overall value, so the
 * rows that stand out are easy to find. Clicking a plaza bubble opens that plaza.
 */
export default function BubbleVisual({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  const t = useTokens();
  const c = chartTheme(t);
  const openPlaza = usePlazaOpener();
  const dim = visual.rows?.[0] ?? '';
  const [xm, ym, sm] = visual.values ?? [];
  const measures = [xm, ym, ...(sm ? [sm] : [])];
  const { rows, error } = useQuery(reportId, { ...base, groupBy: [dim], measures });
  const overall = useQuery(reportId, { ...base, groupBy: [], measures: [ym] }).rows?.[0]?.[ym];
  const fmt = (m: string) => spec.measures[m]?.format;
  const lbl = (m: string) => spec.measures[m]?.label ?? m;
  const axisFmt = (m: string) => (v: number) => (fmt(m) === 'percent' ? `${Math.round(v * 100)}%` : fmt(m) === 'currency' ? formatCompactCurrency(v) : String(v));

  const pts = (rows ?? []).map((r) => ({ name: String(r[dim] ?? '(Blank)'), x: Number(r[xm] ?? 0), y: r[ym] == null ? null : Number(r[ym]), s: sm ? Number(r[sm] ?? 0) : 1 }))
    .filter((p) => p.y !== null) as { name: string; x: number; y: number; s: number }[];
  const maxS = Math.max(1e-9, ...pts.map((p) => Math.abs(p.s)));
  const maxY = Math.max(1e-9, ...pts.map((p) => Math.abs(p.y)));
  const colour = (y: number) => {
    const k = Math.min(1, Math.abs(y) / maxY);
    return y > 0 ? `color-mix(in srgb, ${t.bad} ${Math.round(45 + k * 55)}%, transparent)` : `color-mix(in srgb, ${t.good} ${Math.round(45 + k * 55)}%, transparent)`;
  };

  const option = rows && {
    grid: { left: 8, right: 24, top: 24, bottom: 28, containLabel: true },
    tooltip: {
      trigger: 'item', ...c.tooltip,
      formatter: (p: { data: { name: string; value: number[] } }) => {
        const [x, y, s] = p.data.value;
        return `<b>${p.data.name}</b><br/>${lbl(xm)}: ${formatValue(x, fmt(xm))}<br/>${lbl(ym)}: ${formatValue(y, fmt(ym))}${sm ? `<br/>${lbl(sm)}: ${formatValue(s, fmt(sm))}` : ''}`;
      },
    },
    xAxis: {
      type: 'value', name: lbl(xm), nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: c.axisText, fontSize: 11 }, scale: true,
      axisLabel: { color: c.axisText, formatter: axisFmt(xm) }, splitLine: { lineStyle: { color: c.grid } },
    },
    yAxis: {
      type: 'value', name: lbl(ym), nameTextStyle: { color: c.axisText, fontSize: 11, align: 'left' },
      axisLabel: { color: c.axisText, formatter: axisFmt(ym) }, splitLine: { lineStyle: { color: c.grid } },
    },
    series: [{
      type: 'scatter',
      data: pts.map((p) => ({
        name: p.name, value: [p.x, p.y, p.s],
        symbolSize: sm ? 12 + Math.sqrt(Math.abs(p.s) / maxS) * 34 : 16,
        itemStyle: { color: colour(p.y), borderColor: p.y > 0 ? t.bad : t.good, borderWidth: 1 },
      })),
      label: { show: true, position: 'right', color: t.textSecondary, fontSize: 10.5, formatter: (p: { data: { name: string } }) => p.data.name },
      labelLayout: { hideOverlap: true },
      emphasis: { focus: 'self', label: { color: t.textPrimary, fontWeight: 700 } },
      cursor: dim === 'plaza' && openPlaza ? 'pointer' : 'default',
      markLine: {
        silent: true, symbol: 'none', lineStyle: { type: 'dashed', color: t.textMuted },
        label: { position: 'insideStartTop', color: t.textMuted, fontSize: 10, formatter: () => `All plazas: ${formatValue(Number(overall ?? 0), fmt(ym))}` },
        data: [{ yAxis: Number(overall ?? 0) }, { yAxis: 0, lineStyle: { type: 'solid', color: c.grid }, label: { show: false } }],
      },
      animationDuration: 900, animationDelay: (i: number) => i * 30,
    }],
  };

  return (
    <Paper sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h2" sx={{ mb: 1 }}>{visual.title}</Typography>
      {error && <Typography color="error">{error}</Typography>}
      <Box sx={{ height: 480, position: 'relative' }}>
        {option
          ? <ReactECharts option={option} style={{ position: 'absolute', inset: 0, height: '100%' }} notMerge
              onEvents={{ click: (p: { data?: { name?: string } }) => { if (dim === 'plaza' && openPlaza && p.data?.name) openPlaza(p.data.name); } }} />
          : <Skeleton variant="rectangular" height="100%" />}
      </Box>
      <Typography sx={{ fontSize: '0.72rem', color: t.textMuted, mt: 0.5 }}>
        Across: {lbl(xm)}. Up: {lbl(ym)}{sm ? `. Bubble size: ${lbl(sm)}` : ''}. Red is above zero, green below; the dashed line is all {spec.dimensions[dim]?.label?.toLowerCase() ?? 'rows'} together.
        {dim === 'plaza' && openPlaza ? ' Click a bubble to open the plaza.' : ''}
      </Typography>
    </Paper>
  );
}
