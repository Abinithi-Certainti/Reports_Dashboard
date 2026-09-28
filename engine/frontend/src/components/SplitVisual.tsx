import { Box, Paper, Skeleton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { QueryRequest, Spec, Visual } from '../api';
import { formatValue } from '../format';
import { useQuery } from '../useQuery';
import { chartTheme, useTokens } from '../theme';

type Base = Omit<QueryRequest, 'measures'>;
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 1 });

/**
 * One measure split in two by one field: the `highlight` values (e.g. Cash) against everything else
 * (e.g. card and other), as one bar with the share of each part and two totals below it.
 */
export default function SplitVisual({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  const t = useTokens();
  const c = chartTheme(t);
  const dim = visual.rows?.[0] ?? '';
  const measure = visual.values?.[0] ?? '';
  const format = spec.measures[measure]?.format;
  const picked = new Set(visual.highlight ?? []);
  const { rows, error } = useQuery(reportId, { ...base, groupBy: [dim], measures: [measure] });

  const first = (rows ?? []).filter((r) => picked.has(String(r[dim]))).reduce((s, r) => s + Number(r[measure] ?? 0), 0);
  const rest = (rows ?? []).filter((r) => !picked.has(String(r[dim]))).reduce((s, r) => s + Number(r[measure] ?? 0), 0);
  const total = Math.max(0, first) + Math.max(0, rest);
  const firstLabel = [...picked].join(' + ') || 'Selected';
  const parts = [
    { label: firstLabel, value: first, colour: c.palette[3] ?? t.accent2, bar: c.palette[3] ?? t.accent2 },
    { label: 'Card and other', value: rest, colour: t.accent, bar: `linear-gradient(90deg, ${t.series1}, ${t.accent})` },
  ];

  return (
    <Paper sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Typography variant="h2">{visual.title}</Typography>
      {error && <Typography color="error">{error}</Typography>}
      {!rows ? (
        <Skeleton variant="rounded" height={120} />
      ) : (
        // Centred in the box, so it sits well next to a taller neighbour of the same row.
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', height: 40, borderRadius: '10px', overflow: 'hidden', bgcolor: alpha(t.textMuted, 0.12) }}>
            {total > 0 && parts.map((p) => {
              const share = Math.max(0, p.value) / total;
              return (
                <Box
                  key={p.label}
                  title={`${p.label}: ${percent.format(share)}`}
                  sx={{
                    width: `${share * 100}%`, background: p.bar, display: 'grid', placeItems: 'center', overflow: 'hidden',
                    color: '#fff', fontFamily: t.mono, fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap',
                    transition: 'width .9s cubic-bezier(.2,.8,.2,1)',
                    animation: 'grow 1s cubic-bezier(.2,.8,.2,1) both', '@keyframes grow': { from: { width: 0 } },
                  }}
                >
                  {share >= 0.12 ? `${p.label} ${percent.format(share)}` : ''}
                </Box>
              );
            })}
          </Box>
          <Typography sx={{ fontSize: '0.78rem', color: t.textSecondary }}>
            How the total splits between {firstLabel.toLowerCase()} and every other payment type.
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {parts.map((p) => (
              <Box key={p.label} sx={{ p: 1.25, borderRadius: '12px', border: `1px solid ${t.panelBorder}`, position: 'relative', overflow: 'hidden' }}>
                <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: p.colour }} />
                <Typography sx={{ fontSize: '0.66rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: t.textSecondary, fontWeight: 650 }}>{p.label}</Typography>
                <Typography sx={{ fontFamily: t.mono, fontWeight: 700, fontSize: '1.45rem', color: t.textPrimary }}>{formatValue(p.value, format)}</Typography>
                <Typography sx={{ fontFamily: t.mono, fontSize: '0.76rem', color: t.textMuted }}>{total > 0 ? percent.format(Math.max(0, p.value) / total) : '–'}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  );
}
