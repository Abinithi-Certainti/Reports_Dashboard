import { useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Box, Paper, Skeleton, Typography } from '@mui/material';
import { QueryRequest, Spec, Visual } from '../api';
import { formatValue } from '../format';
import { useQuery } from '../useQuery';
import { chartTheme, useTokens } from '../theme';
import { useSound } from '../sound';
import { PLAZA_DIM, usePlazaOpener } from './PlazaDetail';

type Base = Omit<QueryRequest, 'measures'>;
const percent = new Intl.NumberFormat('en-CA', { style: 'percent', maximumFractionDigits: 1 });

/**
 * Share of one measure by one field, as a ring. The centre shows the total, or the slice under the pointer.
 * Negative values cannot be drawn as a share, so they are left out of the ring (and still listed below).
 */
export default function DonutVisual({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  const t = useTokens();
  const c = chartTheme(t);
  const sound = useSound();
  const dim = visual.rows?.[0] ?? '';
  const measure = visual.values?.[0] ?? '';
  const format = spec.measures[measure]?.format;
  const { rows, error } = useQuery(reportId, { ...base, groupBy: [dim], measures: [measure] });
  const [hover, setHover] = useState<number | null>(null);
  const openPlaza = usePlazaOpener();
  const clickable = dim === PLAZA_DIM && !!openPlaza;
  const openSlice = (name: string) => { if (clickable && name !== 'Other' && name !== '(Blank)') openPlaza!(name); };

  // Largest first. With `limit`, the smaller slices are added up as one "Other" slice so the ring stays readable.
  const sorted = (rows ?? [])
    .map((r) => ({ name: String(r[dim] ?? '(Blank)'), value: Number(r[measure] ?? 0) }))
    .sort((a, b) => (visual.limit ? b.value - a.value : 0));
  const kept = visual.limit && sorted.length > visual.limit + 1
    ? [...sorted.slice(0, visual.limit), { name: 'Other', value: sorted.slice(visual.limit).reduce((s, x) => s + x.value, 0) }]
    : sorted;
  const items = kept.map((x, i) => ({ ...x, colour: c.palette[i % c.palette.length] }));
  const total = items.reduce((s, x) => s + Math.max(0, x.value), 0);
  const focus = hover !== null ? items[hover] : null;

  const option = rows && {
    tooltip: { show: false },
    series: [{
      type: 'pie', cursor: clickable ? 'pointer' : 'default', radius: ['62%', '84%'], center: ['50%', '50%'], padAngle: 2, minAngle: 2,
      itemStyle: { borderRadius: 6, borderColor: t.panelSolid, borderWidth: 2, shadowBlur: t.glow ? 12 : 0, shadowColor: t.glow || 'transparent' },
      label: { show: false },
      emphasis: { scale: true, scaleSize: 6, itemStyle: { shadowBlur: 20, shadowColor: t.glow || 'rgba(15,23,42,0.25)' } },
      data: items.filter((x) => x.value > 0).map((x) => ({ name: x.name, value: x.value, itemStyle: { color: x.colour } })),
      animationType: 'scale', animationEasing: 'cubicOut', animationDuration: 1000,
    }],
  };
  const onEvents = {
    mouseover: (p: { name: string }) => {
      setHover(items.findIndex((x) => x.name === p.name));
      sound.play('click');
    },
    mouseout: () => setHover(null),
    click: (p: { name: string }) => openSlice(p.name),
  };

  return (
    <Paper sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h2" sx={{ mb: 1 }}>{visual.title}</Typography>
      {error && <Typography color="error">{error}</Typography>}
      {!option ? (
        <Skeleton variant="circular" width={200} height={200} sx={{ mx: 'auto', my: 2 }} />
      ) : (
        <>
          {/* The ring takes whatever height the row leaves after the legend (at least 180px). */}
          <Box sx={{ position: 'relative', flex: 1, minHeight: 180 }}>
            <ReactECharts option={option} onEvents={onEvents} style={{ position: 'absolute', inset: 0, height: '100%' }} notMerge />
            <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', textAlign: 'center' }}>
              <Box>
                <Typography sx={{ fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: focus ? focus.colour : t.textMuted, fontWeight: 650 }}>
                  {focus ? focus.name : 'Total'}
                </Typography>
                <Typography sx={{ fontFamily: t.mono, fontWeight: 700, fontSize: '1.15rem', color: t.textPrimary }}>
                  {formatValue(focus ? focus.value : total, format)}
                </Typography>
                {focus && total > 0 && (
                  <Typography sx={{ fontFamily: t.mono, fontSize: '0.75rem', color: t.textSecondary }}>{percent.format(Math.max(0, focus.value) / total)}</Typography>
                )}
              </Box>
            </Box>
          </Box>
          <Box sx={{ display: 'grid', gap: 0.25, mt: 0.75 }}>
            {items.map((x, i) => (
              <Box
                key={x.name}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                {...(clickable && x.name !== 'Other' ? {
                  role: 'button', tabIndex: 0, 'aria-label': `Open plaza ${x.name}`, onClick: () => openSlice(x.name),
                  onKeyDown: (e: { key: string; preventDefault: () => void }) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSlice(x.name); } },
                } : {})}
                sx={{
                  cursor: clickable && x.name !== 'Other' ? 'pointer' : 'default',
                  ...(clickable && x.name !== 'Other' ? { '&:hover .donut-name': { textDecoration: 'underline', color: t.accent } } : {}),
                  display: 'grid', gridTemplateColumns: '10px 1fr auto auto', alignItems: 'center', gap: 1, px: 1, py: 0.35, borderRadius: '8px',
                  bgcolor: hover === i ? `${x.colour}1a` : 'transparent', transition: 'background .2s ease',
                }}
              >
                <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: x.colour, boxShadow: t.glow ? `0 0 8px ${x.colour}` : 'none' }} />
                <Typography className="donut-name" sx={{ fontSize: '0.82rem', color: t.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.name}</Typography>
                <Typography sx={{ fontFamily: t.mono, fontSize: '0.78rem', color: t.textSecondary }}>{formatValue(x.value, format)}</Typography>
                <Typography sx={{ fontFamily: t.mono, fontSize: '0.78rem', color: t.textPrimary, minWidth: 48, textAlign: 'right' }}>
                  {total > 0 ? percent.format(Math.max(0, x.value) / total) : ''}
                </Typography>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Paper>
  );
}
