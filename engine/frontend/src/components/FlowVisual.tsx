import ReactECharts from 'echarts-for-react';
import { Box, Paper, Skeleton, Typography } from '@mui/material';
import { QueryRequest, Spec, Visual } from '../api';
import { formatCompactCurrency, formatValue } from '../format';
import { useQuery } from '../useQuery';
import { chartTheme, useTokens } from '../theme';

type Base = Omit<QueryRequest, 'measures'>;
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 1 });

/**
 * Where what came in went, as a donut. The '+' values add up to what was available; the ring splits that into the
 * `total` (what was used, named in the centre) and each '-' value. When they do not add up, the gap is its own
 * "Other adjustments" slice, never hidden.
 */
export default function FlowVisual({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  const t = useTokens();
  const c = chartTheme(t);
  const steps = visual.values ?? [];
  const signs = visual.signs ?? steps.map(() => '+');
  const total = visual.total ?? null;
  const { rows, error } = useQuery(reportId, { ...base, groupBy: [], measures: total ? [...steps, total] : steps });
  const format = spec.measures[steps[0]]?.format;
  const r = rows?.[0];
  const label = (m: string) => (spec.measures[m]?.label ?? m).replace(/ \$$/, '');

  const ins: { name: string; value: number }[] = [];
  const slices: { name: string; value: number; colour: string }[] = [];
  if (r) {
    if (total) slices.push({ name: `Used (${label(total)})`, value: Number(r[total] ?? 0), colour: t.accent2 });
    // The largest '-' value is what is left over (grey); smaller ones are losses along the way (red).
    const minus = steps.filter((_, i) => signs[i] === '-');
    const biggest = minus.reduce<string | null>((best, m) => (best === null || Number(r[m] ?? 0) > Number(r[best] ?? 0) ? m : best), null);
    steps.forEach((m, i) => {
      const v = Number(r[m] ?? 0);
      if (signs[i] === '-') slices.push({ name: label(m), value: v, colour: m === biggest ? '#64748b' : t.bad });
      else ins.push({ name: label(m), value: v });
    });
    const gap = ins.reduce((a, x) => a + x.value, 0) - slices.reduce((a, x) => a + x.value, 0);
    if (Math.abs(gap) >= 0.5) slices.push({ name: 'Other adjustments', value: Math.abs(gap), colour: '#f59e0b' });
  }
  const available = ins.reduce((a, x) => a + x.value, 0);
  const used = total ? slices[0] : undefined;

  const option = r && available > 0 && {
    tooltip: { trigger: 'item', ...c.tooltip, formatter: (p: { name: string; value: number }) => `${p.name}<br/><b>${formatValue(p.value, format)}</b> · ${percent.format(p.value / available)}` },
    series: [{
      type: 'pie', radius: ['58%', '84%'], center: ['50%', '50%'], avoidLabelOverlap: true, minAngle: 2,
      itemStyle: { borderColor: t.panelSolid, borderWidth: 3, borderRadius: 6 },
      label: { show: false }, labelLine: { show: false },
      emphasis: { scale: true, scaleSize: 6 },
      data: slices.filter((s) => s.value > 0).map((s) => ({ name: s.name, value: s.value, itemStyle: { color: s.colour } })),
      animationDuration: 1000, animationEasing: 'cubicOut',
    }],
  };

  return (
    <Paper sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h2" sx={{ mb: 1 }}>{visual.title}</Typography>
      {error && <Typography color="error">{error}</Typography>}
      {!rows ? <Skeleton variant="rectangular" height={300} /> : !option ? (
        <Typography sx={{ color: t.textMuted, py: 6, textAlign: 'center' }}>No stock movement for these filters.</Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(220px, 1fr) minmax(0, 1fr)' }, gap: 2, alignItems: 'center', flex: 1 }}>
          <Box sx={{ position: 'relative', height: 300 }}>
            <ReactECharts option={option} style={{ position: 'absolute', inset: 0, height: '100%' }} notMerge />
            {used && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center', pointerEvents: 'none' }}>
                <Box sx={{ fontSize: '0.72rem', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{label(total!)}</Box>
                <Box sx={{ fontFamily: t.mono, fontWeight: 700, fontSize: '1.6rem', color: t.textPrimary, lineHeight: 1.2 }}>{formatCompactCurrency(used.value)}</Box>
                <Box sx={{ fontSize: '0.78rem', color: t.textSecondary }}>{percent.format(used.value / available)} of stock used</Box>
              </Box>
            )}
          </Box>
          <Box sx={{ display: 'grid', gap: 1.25, minWidth: 0 }}>
            {slices.map((s) => (
              <Box key={s.name} sx={{ display: 'grid', gridTemplateColumns: '12px minmax(0, 1fr) auto', gap: 1, alignItems: 'center' }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '4px', bgcolor: s.colour }} />
                <Box sx={{ color: t.textPrimary, fontSize: '0.85rem', minWidth: 0 }}>{s.name}</Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Box sx={{ fontFamily: t.mono, fontWeight: 700, color: t.textPrimary }}>{formatCompactCurrency(s.value)}</Box>
                  <Box sx={{ fontFamily: t.mono, fontSize: '0.72rem', color: t.textMuted }}>{percent.format(s.value / available)}</Box>
                </Box>
              </Box>
            ))}
            <Box sx={{ mt: 0.5, pt: 1, borderTop: `1px solid ${t.grid}`, fontSize: '0.78rem', color: t.textSecondary }}>
              Stock available <b style={{ fontFamily: t.mono, color: t.textPrimary }}>{formatCompactCurrency(available)}</b>
              {' = '}{ins.map((x) => `${x.name} ${formatCompactCurrency(x.value)}`).join(' + ')}
            </Box>
          </Box>
        </Box>
      )}
    </Paper>
  );
}
