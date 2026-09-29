import { Box, Paper, Skeleton, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { QueryRequest, Spec, Visual } from '../api';
import { formatCompactCurrency, formatValue } from '../format';
import { useQuery } from '../useQuery';
import { useTokens } from '../theme';
import { PlazaLink } from './PlazaDetail';

type Base = Omit<QueryRequest, 'measures'>;
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 0 });

/**
 * Actual against target, one row per rows[0] (e.g. plaza): values[0] is the actual (the bar), values[1] the target
 * (the tick). The grey band runs to 110% of the target. The right column shows actual as a % of target, green at or
 * above 100%, amber from 95%, red below.
 */
export default function BulletVisual({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  const t = useTokens();
  const dim = visual.rows?.[0] ?? '';
  const [actual, target] = visual.values ?? [];
  const format = spec.measures[actual]?.format;
  const { rows, error } = useQuery(reportId, { ...base, groupBy: [dim], measures: [actual, target] });

  const items = (rows ?? []).map((r) => ({ name: String(r[dim] ?? '(Blank)'), a: Number(r[actual] ?? 0), b: Number(r[target] ?? 0) }));
  const max = Math.max(1, ...items.map((x) => Math.max(x.a, x.b * 1.1)));
  const w = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  const tone = (share: number | null) => (share === null ? t.textMuted : share >= 1 ? t.good : share >= 0.95 ? '#f59e0b' : t.bad);

  return (
    <Paper sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h2" sx={{ mb: 1 }}>{visual.title}</Typography>
      {error && <Typography color="error">{error}</Typography>}
      {!rows ? <Skeleton variant="rectangular" height={260} /> : (
        <>
          <Box sx={{ display: 'grid', gap: 0.9, flex: 1, alignContent: 'start' }}>
            {items.map((x, i) => {
              const share = x.b > 0 ? x.a / x.b : null;
              return (
                <Tooltip key={x.name} placement="top" title={`${x.name}: ${formatValue(x.a, format)} of ${formatValue(x.b, format)} budget`}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 150px) minmax(0, 1fr) 64px 46px', gap: 1, alignItems: 'center', fontSize: '0.8rem' }}>
                    <Box sx={{ color: t.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {dim === 'plaza' ? <PlazaLink name={x.name} /> : x.name}
                    </Box>
                    <Box sx={{ position: 'relative', height: 16, borderRadius: '5px', bgcolor: alpha(t.textMuted, 0.1) }}>
                      <Box sx={{ position: 'absolute', inset: 0, right: 'auto', width: w(x.b * 1.1), borderRadius: '5px', bgcolor: alpha(t.textMuted, 0.16) }} />
                      <Box
                        sx={{
                          position: 'absolute', top: 4, bottom: 4, left: 0, width: w(x.a), borderRadius: '4px',
                          background: `linear-gradient(90deg, ${t.series1}, ${t.accent})`, boxShadow: t.glow ? `0 0 10px ${t.glow}` : 'none',
                          animation: 'bulletGrow .9s cubic-bezier(.2,.8,.2,1) both', animationDelay: `${i * 50}ms`,
                          '@keyframes bulletGrow': { from: { width: 0 } },
                        }}
                      />
                      {x.b > 0 && <Box sx={{ position: 'absolute', top: -3, bottom: -3, left: w(x.b), width: 3, ml: '-1.5px', borderRadius: 2, bgcolor: t.textPrimary }} />}
                    </Box>
                    <Box sx={{ fontFamily: t.mono, textAlign: 'right', color: t.textSecondary }}>{format === 'currency' ? formatCompactCurrency(x.a) : formatValue(x.a, format)}</Box>
                    <Box sx={{ fontFamily: t.mono, textAlign: 'right', fontWeight: 700, color: tone(share) }}>{share === null ? '–' : percent.format(share)}</Box>
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1.25, fontSize: '0.72rem', color: t.textSecondary }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Box sx={{ width: 14, height: 7, borderRadius: 2, background: `linear-gradient(90deg, ${t.series1}, ${t.accent})` }} />{spec.measures[actual]?.label}</Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Box sx={{ width: 3, height: 12, borderRadius: 1, bgcolor: t.textPrimary }} />{spec.measures[target]?.label}</Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Box sx={{ width: 14, height: 7, borderRadius: 2, bgcolor: alpha(t.textMuted, 0.3) }} />up to 110% of it</Box>
          </Box>
        </>
      )}
    </Paper>
  );
}
