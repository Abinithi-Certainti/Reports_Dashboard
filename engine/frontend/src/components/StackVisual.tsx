import { Box, Paper, Skeleton, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { QueryRequest, Spec, Visual } from '../api';
import { formatCompactCurrency, formatValue } from '../format';
import { useQuery } from '../useQuery';
import { useTokens } from '../theme';
import { PlazaLink } from './PlazaDetail';

type Base = Omit<QueryRequest, 'measures'>;
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 1 });

/**
 * One row per rows[0] (e.g. plaza), largest total first. The bar stacks every value except the last; the last value
 * (e.g. variance) can be below zero, so it is shown as its own signed number with its share of the row total instead of
 * a bar that would run backwards past zero. The legend shows each part's total and share across all rows.
 */
export default function StackVisual({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  const t = useTokens();
  const dim = visual.rows?.[0] ?? '';
  const measures = visual.values ?? [];
  const parts = measures.slice(0, -1);
  const last = measures[measures.length - 1];
  const format = spec.measures[measures[0]]?.format;
  const { rows, error } = useQuery(reportId, { ...base, groupBy: [dim], measures });
  const colours = [t.series1, '#f59e0b', t.accent2, t.accent];

  const items = (rows ?? []).map((r) => {
    const vals = parts.map((m) => Number(r[m] ?? 0));
    const rest = Number(r[last] ?? 0);
    return { name: String(r[dim] ?? '(Blank)'), vals, rest, total: vals.reduce((a, b) => a + b, 0) + rest };
  }).sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...items.map((x) => x.vals.reduce((a, b) => a + Math.max(0, b), 0)));
  const sums = parts.map((_, i) => items.reduce((a, x) => a + x.vals[i], 0));
  const restSum = items.reduce((a, x) => a + x.rest, 0);
  const grand = sums.reduce((a, b) => a + b, 0) + restSum;
  const share = (v: number, of: number) => (of ? percent.format(v / of) : '–');
  // Variance above expected cost is money lost (red); below is good (green).
  const tone = (v: number) => (v > 0 ? t.bad : v < 0 ? t.good : t.textMuted);
  const label = (m: string) => spec.measures[m]?.label ?? m;

  return (
    <Paper sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h2" sx={{ mb: 1 }}>{visual.title}</Typography>
      {error && <Typography color="error">{error}</Typography>}
      {!rows ? <Skeleton variant="rectangular" height={260} /> : (
        <>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.25 }}>
            {parts.map((m, i) => (
              <Box key={m} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5, borderRadius: '8px', bgcolor: alpha(colours[i], 0.1), fontSize: '0.75rem' }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: colours[i] }} />
                <span style={{ color: t.textSecondary }}>{label(m)}</span>
                <b style={{ fontFamily: t.mono, color: t.textPrimary }}>{formatCompactCurrency(sums[i])}</b>
                <span style={{ fontFamily: t.mono, color: t.textMuted }}>{share(sums[i], grand)}</span>
              </Box>
            ))}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5, borderRadius: '8px', bgcolor: alpha(tone(restSum), 0.1), fontSize: '0.75rem' }}>
              <span style={{ color: t.textSecondary }}>{label(last)}</span>
              <b style={{ fontFamily: t.mono, color: tone(restSum) }}>{restSum > 0 ? '+' : ''}{formatCompactCurrency(restSum)}</b>
              <span style={{ fontFamily: t.mono, color: t.textMuted }}>{share(restSum, grand)}</span>
            </Box>
          </Box>
          <Box sx={{
            display: 'grid', gridTemplateColumns: 'minmax(90px, 140px) minmax(0, 1fr) 62px 74px', gap: 1, px: 0.25, pb: 0.5,
            fontSize: '0.66rem', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
          }}>
            <span>{spec.dimensions[dim]?.label}</span><span>{parts.map(label).join(' + ')}</span>
            <span style={{ textAlign: 'right' }}>Total</span><span style={{ textAlign: 'right' }}>{label(last)}</span>
          </Box>
          <Box sx={{ display: 'grid', gap: 0.6, overflow: 'auto', maxHeight: 560 }}>
            {items.map((x, i) => (
              <Tooltip key={x.name} placement="top" title={
                <Box sx={{ fontSize: '0.75rem' }}>
                  <b>{x.name}</b>
                  {parts.map((m, j) => <div key={m}>{label(m)}: {formatValue(x.vals[j], format)}</div>)}
                  <div>{label(last)}: {formatValue(x.rest, format)} ({share(x.rest, x.total)} of total)</div>
                  <div>Total: {formatValue(x.total, format)}</div>
                </Box>
              }>
                <Box sx={{
                  display: 'grid', gridTemplateColumns: 'minmax(90px, 140px) minmax(0, 1fr) 62px 74px', gap: 1, alignItems: 'center',
                  fontSize: '0.8rem', px: 0.25, py: 0.2, borderRadius: '6px', '&:hover': { bgcolor: alpha(t.textMuted, 0.08) },
                }}>
                  <Box sx={{ color: t.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {dim === 'plaza' ? <PlazaLink name={x.name} /> : x.name}
                  </Box>
                  <Box sx={{ display: 'flex', height: 14, borderRadius: '4px', overflow: 'hidden', bgcolor: alpha(t.textMuted, 0.08) }}>
                    {x.vals.map((v, j) => (
                      <Box key={j} sx={{
                        width: `${(Math.max(0, v) / max) * 100}%`, bgcolor: colours[j],
                        animation: 'stackGrow .8s cubic-bezier(.2,.8,.2,1) both', animationDelay: `${i * 35}ms`,
                        '@keyframes stackGrow': { from: { width: 0 } },
                      }} />
                    ))}
                  </Box>
                  <Box sx={{ fontFamily: t.mono, textAlign: 'right', color: t.textSecondary }}>{formatCompactCurrency(x.total)}</Box>
                  <Box sx={{ fontFamily: t.mono, textAlign: 'right', fontWeight: 700, color: tone(x.rest) }}>
                    {x.rest > 0 ? '+' : ''}{formatCompactCurrency(x.rest)}
                    <Box component="span" sx={{ display: 'block', fontSize: '0.66rem', fontWeight: 500, color: t.textMuted }}>{share(x.rest, x.total)}</Box>
                  </Box>
                </Box>
              </Tooltip>
            ))}
          </Box>
        </>
      )}
    </Paper>
  );
}
