import { Box, Paper, Skeleton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { QueryRequest, Spec, Visual } from '../api';
import { formatCompactCurrency, formatValue } from '../format';
import { useQuery } from '../useQuery';
import { useTokens } from '../theme';

type Base = Omit<QueryRequest, 'measures'>;
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 1 });

/**
 * The steps of a total written out as a sum of number cards: values joined by their signs ('+' or '-'), then '=' and
 * the `total`. When the steps do not add up to the total, the gap is its own "Other adjustments" card, never hidden.
 * Each card shows its share of what came in (the '+' values).
 */
export default function FlowVisual({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  const t = useTokens();
  const steps = visual.values ?? [];
  const signs = visual.signs ?? steps.map(() => '+');
  const total = visual.total ?? null;
  const { rows, error } = useQuery(reportId, { ...base, groupBy: [], measures: total ? [...steps, total] : steps });
  const format = spec.measures[steps[0]]?.format;
  const r = rows?.[0];
  const label = (m: string) => (spec.measures[m]?.label ?? m).replace(/ \$$/, '');

  type Card = { sign: string; name: string; value: number; colour: string };
  const cards: Card[] = [];
  let incoming = 0;
  if (r) {
    let run = 0;
    steps.forEach((m, i) => {
      const v = Number(r[m] ?? 0);
      const minus = signs[i] === '-';
      if (!minus) incoming += v;
      run += minus ? -v : v;
      cards.push({ sign: i === 0 ? '' : minus ? '−' : '+', name: label(m), value: v, colour: minus ? t.bad : i === 0 ? t.series1 : t.accent });
    });
    if (total) {
      const end = Number(r[total] ?? 0);
      const gap = end - run;
      if (Math.abs(gap) >= 0.5) cards.push({ sign: gap > 0 ? '+' : '−', name: 'Other adjustments', value: Math.abs(gap), colour: '#f59e0b' });
      cards.push({ sign: '=', name: label(total), value: end, colour: t.accent2 });
    }
  }
  const result = cards[cards.length - 1];

  return (
    <Paper sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h2" sx={{ mb: 1.25 }}>{visual.title}</Typography>
      {error && <Typography color="error">{error}</Typography>}
      {!rows ? <Skeleton variant="rectangular" height={300} /> : (
        <>
          <Box sx={{ display: 'grid', gap: 0.75 }}>
            {cards.map((c) => {
              const isTotal = c.sign === '=' && total;
              return (
                <Box key={c.name} sx={{ display: 'grid', gridTemplateColumns: '26px minmax(0, 1fr)', gap: 1, alignItems: 'center' }}>
                  <Box sx={{ fontFamily: t.mono, fontSize: '1.25rem', fontWeight: 700, color: c.colour, textAlign: 'center' }}>{c.sign}</Box>
                  <Box sx={{
                    display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 1, alignItems: 'center', px: 1.5, py: 1.1, borderRadius: '10px',
                    bgcolor: alpha(c.colour, isTotal ? 0.16 : 0.08), border: `1px solid ${alpha(c.colour, isTotal ? 0.5 : 0.18)}`,
                  }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ fontWeight: isTotal ? 700 : 600, color: t.textPrimary }}>{c.name}</Box>
                      <Box sx={{ height: 5, mt: 0.6, borderRadius: 3, bgcolor: alpha(t.textMuted, 0.12), overflow: 'hidden' }}>
                        <Box sx={{ height: '100%', width: `${incoming ? Math.min(100, (c.value / incoming) * 100) : 0}%`, minWidth: c.value ? 3 : 0, bgcolor: c.colour, borderRadius: 3 }} />
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Box sx={{ fontFamily: t.mono, fontWeight: 700, fontSize: isTotal ? '1.2rem' : '1.05rem', color: t.textPrimary }}>{formatCompactCurrency(c.value)}</Box>
                      <Box sx={{ fontFamily: t.mono, fontSize: '0.7rem', color: t.textMuted }}>{formatValue(c.value, format)}</Box>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
          {result && incoming > 0 && (
            <Typography sx={{ mt: 1.5, fontSize: '0.8rem', color: t.textSecondary }}>
              Of the {formatCompactCurrency(incoming)} that came in ({cards.filter((c) => c.sign === '' || c.sign === '+').filter((c) => c.name !== 'Other adjustments').map((c) => c.name).join(' + ')}),{' '}
              <b style={{ color: t.textPrimary }}>{percent.format(result.value / incoming)}</b> became {result.name}. The small bars show each amount as a share of that.
            </Typography>
          )}
        </>
      )}
    </Paper>
  );
}
