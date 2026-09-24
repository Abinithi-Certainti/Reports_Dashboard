import { Box, Paper, Skeleton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { QueryRequest, Spec, Visual } from '../api';
import { formatValue } from '../format';
import { useQuery } from '../useQuery';
import { useTokens } from '../theme';

type Base = Omit<QueryRequest, 'measures'>;
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 1 });
// Gold, silver, bronze for the top three.
const MEDALS = ['linear-gradient(135deg,#fde68a,#f59e0b)', 'linear-gradient(135deg,#f1f5f9,#94a3b8)', 'linear-gradient(135deg,#fdba74,#c2410c)'];

/**
 * Ranks the groups of one or more fields by the first value, biggest first, and shows the top `limit` (default 8).
 * A second value, if listed, is shown under each name.
 */
export default function LeaderboardVisual({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  const t = useTokens();
  const dims = visual.rows ?? [];
  const [measure, second] = visual.values ?? [];
  const measures = [measure, second].filter((m): m is string => !!m && !!spec.measures[m]);
  const { rows, error } = useQuery(reportId, { ...base, groupBy: dims, measures });
  const format = spec.measures[measure]?.format;

  const ranked = (rows ?? [])
    .map((r) => ({ name: dims.map((d) => String(r[d] ?? '(Blank)')).join(' · '), value: Number(r[measure] ?? 0), second: second ? r[second] : null }))
    .sort((a, b) => b.value - a.value);
  const total = ranked.reduce((s, x) => s + Math.max(0, x.value), 0);
  const top = ranked.slice(0, visual.limit ?? 8);
  const max = Math.max(1, ...top.map((x) => x.value));

  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="h2">{visual.title}</Typography>
        {rows && (
          <Typography sx={{ fontSize: '0.75rem', color: t.textMuted }}>
            Top {top.length} of {ranked.length} · by {spec.measures[measure]?.label}
          </Typography>
        )}
      </Box>
      {error && <Typography color="error">{error}</Typography>}
      {!rows ? (
        <Skeleton variant="rectangular" height={220} />
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', columnGap: 3, rowGap: 1.25 }}>
          {top.map((x, i) => (
            <Box
              key={x.name}
              sx={{
                display: 'grid', gridTemplateColumns: '30px 1fr auto', alignItems: 'center', columnGap: 1.25, px: 1, py: 0.75, borderRadius: '12px',
                transition: 'background .2s ease, transform .2s ease',
                '&:hover': { bgcolor: alpha(t.accent, 0.07), transform: 'translateX(3px)' },
              }}
            >
              <Box
                sx={{
                  width: 28, height: 28, borderRadius: '9px', display: 'grid', placeItems: 'center', fontFamily: t.mono, fontSize: '0.78rem', fontWeight: 750,
                  background: i < 3 ? MEDALS[i] : alpha(t.textMuted, 0.14), color: i < 3 ? '#1f2937' : t.textSecondary,
                  boxShadow: i === 0 && t.glow ? '0 0 14px rgba(245,158,11,0.55)' : 'none',
                }}
              >
                {i + 1}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.86rem', fontWeight: 600, color: t.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {x.name}
                </Typography>
                <Box sx={{ height: 6, borderRadius: 3, bgcolor: alpha(t.textMuted, 0.12), mt: 0.5, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      height: '100%', width: `${(Math.max(0, x.value) / max) * 100}%`, borderRadius: 3,
                      background: `linear-gradient(90deg, ${t.series1}, ${t.accent2})`, boxShadow: t.glow ? `0 0 10px ${t.glow}` : 'none',
                      transformOrigin: 'left', animation: 'grow .9s cubic-bezier(.2,.8,.2,1) both', animationDelay: `${150 + i * 70}ms`,
                      transition: 'width .6s ease',
                      '@keyframes grow': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
                    }}
                  />
                </Box>
                {second && (
                  <Typography sx={{ fontSize: '0.7rem', color: t.textMuted, mt: 0.25 }}>
                    {spec.measures[second]?.label}: {formatValue(x.second, spec.measures[second]?.format)}
                  </Typography>
                )}
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontFamily: t.mono, fontSize: '0.84rem', fontWeight: 650, color: t.textPrimary }}>{formatValue(x.value, format)}</Typography>
                <Typography sx={{ fontFamily: t.mono, fontSize: '0.7rem', color: t.textMuted }}>{total > 0 ? percent.format(Math.max(0, x.value) / total) : ''}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}
