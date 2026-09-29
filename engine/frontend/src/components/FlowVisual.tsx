import ReactECharts from 'echarts-for-react';
import { Box, Paper, Skeleton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { QueryRequest, Spec, Visual } from '../api';
import { formatCompactCurrency, formatValue } from '../format';
import { useQuery } from '../useQuery';
import { chartTheme, useTokens } from '../theme';

type Base = Omit<QueryRequest, 'measures'>;
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 1 });

/**
 * A flow (Sankey) diagram of the same set-up as a waterfall: the '+' values flow into one middle node (what was
 * available), which splits into the '-' values and the `total` (what was used). When the two sides do not balance, the
 * gap is its own "Other adjustments" band, never hidden. Band widths are to scale.
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

  const MID = 'Stock available';
  const ins: { name: string; value: number }[] = [];
  const outs: { name: string; value: number; used?: boolean }[] = [];
  if (r) {
    steps.forEach((m, i) => (signs[i] === '-' ? outs : ins).push({ name: label(m), value: Number(r[m] ?? 0) }));
    if (total) outs.unshift({ name: `Used · ${label(total)}`, value: Number(r[total] ?? 0), used: true });
    const gap = ins.reduce((a, x) => a + x.value, 0) - outs.reduce((a, x) => a + x.value, 0);
    if (Math.abs(gap) >= 0.5) (gap > 0 ? outs : ins).push({ name: 'Other adjustments', value: Math.abs(gap) });
  }
  const available = ins.reduce((a, x) => a + x.value, 0);
  const used = outs.find((o) => o.used)?.value ?? 0;
  const shelf = outs.find((o) => !o.used && o.name !== 'Other adjustments' && o.name !== 'Transfers out')?.value ?? 0;
  const inColours = [c.series1, t.accent, '#0891b2'];
  const outColour = (o: { name: string; used?: boolean }) => (o.used ? t.accent2 : o.name === 'Other adjustments' ? '#f59e0b' : o.name.startsWith('Transfer') ? t.bad : '#64748b');
  const visible = (x: { value: number }) => x.value > 0;

  const option = r && available > 0 && {
    tooltip: {
      trigger: 'item', ...c.tooltip,
      formatter: (p: { dataType: string; name: string; value: number; data: { source?: string; target?: string } }) =>
        p.dataType === 'edge'
          ? `${p.data.source} → ${p.data.target}<br/><b>${formatValue(p.value, format)}</b> · ${percent.format(p.value / available)} of stock`
          : `${p.name}<br/><b>${formatValue(p.value, format)}</b>`,
    },
    series: [{
      type: 'sankey', left: 4, right: 150, top: 12, bottom: 12, nodeWidth: 14, nodeGap: 14, draggable: false,
      layoutIterations: 0, emphasis: { focus: 'adjacency' },
      data: [
        ...ins.filter(visible).map((x, i) => ({ name: x.name, itemStyle: { color: inColours[i % inColours.length], borderWidth: 0 } })),
        { name: MID, itemStyle: { color: t.textMuted, borderWidth: 0 } },
        ...outs.filter(visible).map((o) => ({ name: o.name, itemStyle: { color: outColour(o), borderWidth: 0 } })),
      ],
      links: [
        ...ins.filter(visible).map((x) => ({ source: x.name, target: MID, value: x.value })),
        ...outs.filter(visible).map((o) => ({ source: MID, target: o.name, value: o.value })),
      ],
      lineStyle: { color: 'gradient', opacity: 0.35, curveness: 0.5 },
      label: {
        color: t.textPrimary, fontSize: 12, fontFamily: t.font,
        formatter: (p: { name: string; value: number }) => `{n|${p.name}}\n{v|${formatCompactCurrency(p.value)}}`,
        rich: { n: { color: t.textSecondary, fontSize: 11, lineHeight: 16 }, v: { color: t.textPrimary, fontFamily: t.mono, fontWeight: 700, fontSize: 13 } },
      },
      animationDuration: 1100, animationEasing: 'cubicOut',
    }],
  };

  const stat = (name: string, value: string, sub: string, colour: string) => (
    <Box sx={{ px: 1.25, py: 1, borderRadius: '10px', bgcolor: alpha(colour, 0.1), minWidth: 0 }}>
      <Box sx={{ fontSize: '0.68rem', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{name}</Box>
      <Box sx={{ fontFamily: t.mono, fontWeight: 700, fontSize: '1rem', color: t.textPrimary }}>{value}</Box>
      <Box sx={{ fontSize: '0.72rem', color: t.textSecondary }}>{sub}</Box>
    </Box>
  );

  return (
    <Paper sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h2" sx={{ mb: 1 }}>{visual.title}</Typography>
      {error && <Typography color="error">{error}</Typography>}
      {!rows ? <Skeleton variant="rectangular" height={420} /> : !option ? (
        <Typography sx={{ color: t.textMuted, py: 6, textAlign: 'center' }}>No stock movement for these filters.</Typography>
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, mb: 1 }}>
            {stat('Stock available', formatCompactCurrency(available), ins.map((x) => x.name).join(' + '), t.textMuted)}
            {stat('Used', formatCompactCurrency(used), `${percent.format(used / available)} of stock`, t.accent2)}
            {stat('Left on shelf', formatCompactCurrency(shelf), `${percent.format(shelf / available)} of stock`, '#64748b')}
          </Box>
          <Box sx={{ height: 400, position: 'relative' }}>
            <ReactECharts option={option} style={{ position: 'absolute', inset: 0, height: '100%' }} notMerge />
          </Box>
          <Typography sx={{ fontSize: '0.72rem', color: t.textMuted, mt: 0.5 }}>
            Band width = amount. What came in on the left, where it went on the right. Hover a band for its share of the stock.
          </Typography>
        </>
      )}
    </Paper>
  );
}
