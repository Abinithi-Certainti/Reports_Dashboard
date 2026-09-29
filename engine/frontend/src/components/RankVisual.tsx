import { Box, Paper, Skeleton, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { QueryRequest, Spec, Visual } from '../api';
import { formatCompactCurrency, formatValue } from '../format';
import { useQuery } from '../useQuery';
import { useTokens } from '../theme';
import { PlazaLink } from './PlazaDetail';

type Base = Omit<QueryRequest, 'measures'>;

/**
 * A simple ranking: one bar per rows[0] (e.g. plaza) for values[0], largest first. The value is a cost-type number, so
 * above zero is red (money lost) and below zero is green. values[1], when given, is shown next to it (e.g. its % of COGS).
 */
export default function RankVisual({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  const t = useTokens();
  const dim = visual.rows?.[0] ?? '';
  const [main, side] = visual.values ?? [];
  const { rows, error } = useQuery(reportId, { ...base, groupBy: [dim], measures: side ? [main, side] : [main] });
  const format = spec.measures[main]?.format;
  const sideFormat = side ? spec.measures[side]?.format : undefined;

  const items = (rows ?? []).map((r) => ({ name: String(r[dim] ?? '(Blank)'), v: Number(r[main] ?? 0), s: side && r[side] != null ? Number(r[side]) : null }))
    .sort((a, b) => b.v - a.v);
  const max = Math.max(1e-9, ...items.map((x) => Math.abs(x.v)));
  const hasNeg = items.some((x) => x.v < 0);
  const colour = (v: number) => (v > 0 ? t.bad : t.good);

  return (
    <Paper sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h2" sx={{ mb: 1.25 }}>{visual.title}</Typography>
      {error && <Typography color="error">{error}</Typography>}
      {!rows ? <Skeleton variant="rectangular" height={300} /> : (
        <Box sx={{ display: 'grid', gap: 0.5, overflow: 'auto', maxHeight: 560 }}>
          {items.map((x, i) => {
            const w = `${(Math.abs(x.v) / max) * (hasNeg ? 50 : 100)}%`;
            return (
              <Tooltip key={x.name} placement="top" title={`${x.name}: ${formatValue(x.v, format)}${x.s !== null ? ` · ${formatValue(x.s, sideFormat)}` : ''}`}>
                <Box sx={{
                  display: 'grid', gridTemplateColumns: 'minmax(90px, 140px) minmax(0, 1fr) 70px 52px', gap: 1, alignItems: 'center',
                  fontSize: '0.8rem', py: 0.25, px: 0.5, borderRadius: '6px', '&:hover': { bgcolor: alpha(t.textMuted, 0.08) },
                }}>
                  <Box sx={{ color: t.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {dim === 'plaza' ? <PlazaLink name={x.name} /> : x.name}
                  </Box>
                  <Box sx={{ position: 'relative', height: 14 }}>
                    {hasNeg && <Box sx={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: '1px', bgcolor: alpha(t.textMuted, 0.4) }} />}
                    <Box sx={{
                      position: 'absolute', top: 0, bottom: 0, width: w, borderRadius: '4px', bgcolor: colour(x.v),
                      ...(hasNeg ? (x.v >= 0 ? { left: '50%' } : { right: '50%' }) : { left: 0 }),
                      animation: 'rankGrow .7s cubic-bezier(.2,.8,.2,1) both', animationDelay: `${i * 30}ms`,
                      '@keyframes rankGrow': { from: { width: 0 } },
                    }} />
                  </Box>
                  <Box sx={{ fontFamily: t.mono, textAlign: 'right', fontWeight: 700, color: colour(x.v) }}>
                    {x.v > 0 ? '+' : ''}{formatCompactCurrency(x.v)}
                  </Box>
                  <Box sx={{ fontFamily: t.mono, textAlign: 'right', color: t.textMuted, fontSize: '0.74rem' }}>
                    {x.s !== null ? formatValue(x.s, sideFormat) : ''}
                  </Box>
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1.25, fontSize: '0.72rem', color: t.textSecondary }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Box sx={{ width: 12, height: 8, borderRadius: 2, bgcolor: t.bad }} />Above zero · money lost</Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Box sx={{ width: 12, height: 8, borderRadius: 2, bgcolor: t.good }} />Below zero · money saved</Box>
        {side && <span>Right column: {spec.measures[side]?.label}</span>}
      </Box>
    </Paper>
  );
}
