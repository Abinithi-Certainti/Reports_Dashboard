import ReactECharts from 'echarts-for-react';
import { Box, Paper, Skeleton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { QueryRequest, Spec, Visual } from '../api';
import { formatCompactCurrency, formatValue } from '../format';
import { useQuery } from '../useQuery';
import { chartTheme, useTokens } from '../theme';

type Base = Omit<QueryRequest, 'measures'>;

/**
 * A running total from a start value to an end value: `values` are the steps, `signs` says whether each step adds
 * (+) or takes away (-), and `total` is the measure the steps should arrive at. When the steps do not add up to the
 * total, the gap is shown as its own "Other adjustments" bar, never hidden. Under the chart the same steps are written
 * out as a sum, so the page shows how the total is worked out.
 */
export default function WaterfallVisual({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  const t = useTokens();
  const c = chartTheme(t);
  const steps = visual.values ?? [];
  const signs = visual.signs ?? steps.map(() => '+');
  const total = visual.total ?? null;
  const measures = total ? [...steps, total] : steps;
  const { rows, error } = useQuery(reportId, { ...base, groupBy: [], measures });
  const format = spec.measures[steps[0]]?.format;
  const r = rows?.[0];

  type Bar = { label: string; from: number; to: number; kind: 'start' | 'up' | 'down' | 'gap' | 'total' };
  const bars: Bar[] = [];
  if (r) {
    let run = 0;
    steps.forEach((m, i) => {
      const v = Number(r[m] ?? 0);
      const label = spec.measures[m]?.label ?? m;
      if (i === 0) { bars.push({ label, from: 0, to: v, kind: 'start' }); run = v; return; }
      const next = signs[i] === '-' ? run - v : run + v;
      bars.push({ label: `${signs[i] === '-' ? '− ' : '+ '}${label}`, from: run, to: next, kind: signs[i] === '-' ? 'down' : 'up' });
      run = next;
    });
    if (total) {
      const end = Number(r[total] ?? 0);
      if (Math.abs(end - run) >= 0.5) bars.push({ label: 'Other adjustments', from: run, to: end, kind: 'gap' });
      bars.push({ label: `= ${spec.measures[total]?.label ?? total}`, from: 0, to: end, kind: 'total' });
    }
  }
  const colour = (k: Bar['kind']) => (k === 'up' ? t.accent : k === 'down' ? t.bad : k === 'gap' ? '#f59e0b' : k === 'total' ? t.accent2 : c.series1);

  const option = r && {
    grid: { left: 8, right: 16, top: 26, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'item', ...c.tooltip,
      formatter: (p: { dataIndex: number }) => {
        const b = bars[p.dataIndex];
        return `${b.label}<br/><b>${formatValue(Math.abs(b.to - b.from), format)}</b>`;
      },
    },
    xAxis: {
      type: 'category', data: bars.map((b) => b.label),
      axisLabel: { color: c.axisText, interval: 0, fontSize: 11 }, axisTick: { show: false }, axisLine: { lineStyle: { color: c.grid } },
    },
    yAxis: { type: 'value', axisLabel: { color: c.axisText, formatter: (v: number) => formatCompactCurrency(v) }, splitLine: { lineStyle: { color: c.grid } } },
    series: [
      // An invisible base lifts each bar to where the running total stands.
      { type: 'bar', stack: 'w', silent: true, itemStyle: { color: 'transparent' }, data: bars.map((b) => Math.min(b.from, b.to)) },
      {
        type: 'bar', stack: 'w', barMaxWidth: 64, barMinHeight: 3, // a very small step still shows as a sliver
        data: bars.map((b) => ({ value: Math.abs(b.to - b.from), itemStyle: { color: colour(b.kind), borderRadius: 6, shadowBlur: t.glow ? 10 : 0, shadowColor: t.glow || 'transparent' } })),
        label: {
          show: true, position: 'top', fontFamily: t.mono, fontSize: 11, fontWeight: 600,
          color: t.textPrimary,
          formatter: (p: { dataIndex: number }) => {
            const b = bars[p.dataIndex];
            const v = formatCompactCurrency(Math.abs(b.to - b.from));
            return b.kind === 'down' ? `−${v}` : b.kind === 'up' ? `+${v}` : v;
          },
        },
        animationDuration: 1000, animationEasing: 'cubicOut', animationDelay: (i: number) => i * 120,
      },
      // Dashed steps joining the end of each bar to the start of the next, so the running total reads left to right.
      {
        type: 'line', step: 'end', silent: true, symbol: 'none', z: 1,
        lineStyle: { type: 'dashed', width: 1, color: alpha(t.textMuted, 0.6) },
        data: bars.map((b) => (b.kind === 'total' ? null : b.to)),
      },
    ],
  };
  const maxAbs = Math.max(1, ...bars.map((b) => Math.abs(b.to - b.from)));

  return (
    <Paper sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h2" sx={{ mb: 1 }}>{visual.title}</Typography>
      {error && <Typography color="error">{error}</Typography>}
      <Box sx={{ height: 280, position: 'relative' }}>
        {option
          ? <ReactECharts option={option} style={{ position: 'absolute', inset: 0, height: '100%' }} notMerge />
          : <Skeleton variant="rectangular" height="100%" />}
      </Box>
      {r && (
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${t.grid}`, display: 'grid', gap: 0.75 }}>
          <Typography sx={{ fontSize: '0.7rem', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            How it adds up
          </Typography>
          {bars.map((b) => {
            const v = Math.abs(b.to - b.from);
            const tone = colour(b.kind);
            const sign = b.kind === 'down' ? '−' : b.kind === 'up' ? '+' : b.kind === 'total' ? '=' : '';
            return (
              <Box key={b.label} sx={{
                display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr) minmax(40px, 30%) minmax(96px, auto)', gap: 1, alignItems: 'center', fontSize: '0.8rem',
                ...(b.kind === 'total' ? { pt: 0.75, borderTop: `1px dashed ${t.grid}`, fontWeight: 700 } : {}),
              }}>
                <Box sx={{ fontFamily: t.mono, color: tone, fontWeight: 700, textAlign: 'center' }}>{sign}</Box>
                <Box sx={{ color: t.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.label.replace(/^[+−=] /, '')}</Box>
                <Box sx={{ height: 6, borderRadius: 3, bgcolor: alpha(t.textMuted, 0.12), overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${Math.max(1.5, (v / maxAbs) * 100)}%`, bgcolor: tone, borderRadius: 3 }} />
                </Box>
                <Box sx={{ fontFamily: t.mono, textAlign: 'right', color: t.textPrimary }}>{formatValue(v, format)}</Box>
              </Box>
            );
          })}
          <Typography sx={{ mt: 0.75, fontSize: '0.75rem', color: t.textMuted, fontFamily: t.mono, overflowWrap: 'anywhere' }}>
            {bars.filter((b) => b.kind !== 'total').map((b, i) => (i === 0 ? b.label : b.label.replace(/^\+ /, '+ '))).join(' ')}
            {total ? ` = ${spec.measures[total]?.label ?? total}` : ''}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
