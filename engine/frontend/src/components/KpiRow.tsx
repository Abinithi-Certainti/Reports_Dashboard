import ReactECharts from 'echarts-for-react';
import { Box, Paper, Skeleton, Tooltip, Typography } from '@mui/material';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import OutboundRoundedIcon from '@mui/icons-material/OutboundRounded';
import TagRoundedIcon from '@mui/icons-material/TagRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import { alpha } from '@mui/material/styles';
import { KpiItem, QueryRequest, Spec, Visual } from '../api';
import { useQuery } from '../useQuery';
import { addDays, formatDay, formatValue } from '../format';
import { chartTheme, useTokens } from '../theme';
import AnimatedNumber from './AnimatedNumber';

type Base = Omit<QueryRequest, 'measures'>;

/** A KPI's own include list narrows the user's filter (intersection); its exclude list is added on top. */
function requestFor(item: KpiItem, base: Base, groupBy: string[]): QueryRequest | null {
  const filters: Record<string, string[]> = { ...(base.filters ?? {}) };
  for (const [dim, only] of Object.entries(item.include ?? {})) {
    const chosen = filters[dim] ?? [];
    const narrowed = chosen.length ? chosen.filter((v) => only.includes(v)) : only;
    if (narrowed.length === 0) return null; // the user filtered this slice out entirely
    filters[dim] = narrowed;
  }
  return { ...base, filters, exclude: item.exclude, groupBy, measures: [item.measure] };
}

/** The same number of days immediately before the chosen range. */
function previousPeriod(base: Base): Base | null {
  if (!base.dateFrom || !base.dateTo) return null;
  const days = Math.round((Date.parse(base.dateTo) - Date.parse(base.dateFrom)) / 86_400_000) + 1;
  return { ...base, dateFrom: addDays(base.dateFrom, -days), dateTo: addDays(base.dateFrom, -1) };
}

/** Icons a KPI can name with `icon:` in the settings file; without one, tiles take them in this order. */
const ICONS = {
  total: AccountBalanceWalletRoundedIcon, cash: PaymentsRoundedIcon, card: CreditCardRoundedIcon, paidout: OutboundRoundedIcon,
  count: TagRoundedIcon, store: StorefrontRoundedIcon, trend: ShowChartRoundedIcon,
} as const;
const ICON_ORDER = ['total', 'cash', 'card', 'paidout', 'trend', 'store'] as const;

function Sparkline({ rows, measure, dateDim, format, colour }: { rows: Record<string, unknown>[]; measure: string; dateDim: string; format?: string | null; colour: string }) {
  const t = useTokens();
  const c = chartTheme(t);
  const option = {
    grid: { left: 0, right: 0, top: 4, bottom: 0 },
    xAxis: { type: 'category', show: false, data: rows.map((r) => String(r[dateDim])) },
    yAxis: { type: 'value', show: false, scale: true },
    tooltip: {
      trigger: 'axis',
      ...c.tooltip,
      formatter: (p: { name: string; value: number }[]) => `${formatDay(p[0].name)}<br/><b>${formatValue(p[0].value, format)}</b>`,
    },
    series: [
      {
        type: 'line',
        data: rows.map((r) => Number(r[measure] ?? 0)),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: colour, shadowColor: t.glow ? colour : 'transparent', shadowBlur: t.glow ? 8 : 0 },
        areaStyle: {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: `${colour}55` }, { offset: 1, color: `${colour}00` }] },
        },
        animationDuration: 1200,
        animationEasing: 'cubicOut',
      },
    ],
  };
  return <ReactECharts option={option} style={{ height: 52 }} notMerge />;
}

function Tile({ reportId, spec, item, base, index }: { reportId: string; spec: Spec; item: KpiItem; base: Base; index: number }) {
  const t = useTokens();
  const dateDim = Object.entries(spec.dimensions).find(([, d]) => d.type === 'date')?.[0];
  const prevBase = previousPeriod(base);
  const request = requestFor(item, base, []);
  const prevRequest = prevBase ? requestFor(item, prevBase, []) : null;
  const trendRequest = dateDim ? requestFor(item, base, [dateDim]) : null;
  const { rows, error } = useQuery(reportId, request);
  const prev = useQuery(reportId, prevRequest);
  const trend = useQuery(reportId, trendRequest);
  const format = spec.measures[item.measure]?.format;
  const value = request === null ? 0 : rows?.[0]?.[item.measure];
  const prevValue = Number(prev.rows?.[0]?.[item.measure] ?? 0);

  let delta: { pct: number; good: boolean } | null = null;
  if (value !== undefined && prev.rows && prevValue > 0) {
    const pct = (Number(value ?? 0) - prevValue) / prevValue;
    const goodWhenUp = (item.good_direction ?? 'up') === 'up';
    delta = { pct, good: pct === 0 ? true : pct > 0 === goodWhenUp };
  }

  const colour = t.palette[index % t.palette.length];
  const Icon = ICONS[item.icon ?? ICON_ORDER[index % ICON_ORDER.length]];

  return (
    <Paper
      sx={{
        p: 2.25, pb: 1, position: 'relative', overflow: 'hidden', height: '100%',
        animation: 'rise .6s ease both', animationDelay: `${index * 80}ms`,
        '@keyframes rise': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'none' } },
        // A coloured edge on top and a soft corner glow, in this tile's own colour.
        '&::before': {
          content: '""', position: 'absolute', inset: '0 0 auto 0', height: t.glow ? 2 : 3,
          background: `linear-gradient(90deg, transparent, ${colour}, transparent)`, opacity: t.mode === 'light' ? 0.7 : 0.9,
        },
        '&::after': {
          content: '""', position: 'absolute', width: 180, height: 180, right: -70, top: -90, borderRadius: '50%', pointerEvents: 'none',
          background: `radial-gradient(circle, ${alpha(colour, t.mode === 'light' ? 0.14 : 0.22)}, transparent 70%)`, transition: 'transform .4s ease',
        },
        transition: 'transform .3s cubic-bezier(.2,.8,.2,1), box-shadow .3s ease, border-color .3s ease',
        '&:hover': {
          transform: 'translateY(-4px)', borderColor: alpha(colour, 0.55),
          boxShadow: `0 20px 40px -22px ${alpha(colour, t.mode === 'light' ? 0.55 : 0.7)}`,
          '&::after': { transform: 'scale(1.25)' },
          '& .kpi-icon': { transform: 'rotate(-8deg) scale(1.08)' },
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, position: 'relative', zIndex: 1 }}>
        <Box
          className="kpi-icon"
          sx={{
            width: 36, height: 36, borderRadius: '11px', display: 'grid', placeItems: 'center', flexShrink: 0,
            color: colour, background: `linear-gradient(135deg, ${alpha(colour, 0.22)}, ${alpha(colour, 0.08)})`,
            boxShadow: `inset 0 0 0 1px ${alpha(colour, 0.3)}${t.glow ? `, 0 0 16px -4px ${alpha(colour, 0.6)}` : ''}`,
            transition: 'transform .3s ease',
          }}
        >
          <Icon sx={{ fontSize: 20 }} />
        </Box>
        <Typography variant="h2" sx={{ fontSize: '0.68rem', flex: 1, lineHeight: 1.3 }}>{item.label}</Typography>
        {delta && (
          <Tooltip title={`vs the previous ${prevBase ? Math.round((Date.parse(base.dateTo!) - Date.parse(base.dateFrom!)) / 86_400_000) + 1 : ''} days (${formatValue(prevValue, format)})`}>
            <Box
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.25, px: 0.75, py: 0.15, borderRadius: '8px', fontSize: '0.72rem', fontWeight: 650,
                fontFamily: t.mono, color: delta.good ? t.good : t.bad, bgcolor: `${delta.good ? t.good : t.bad}1f`,
                boxShadow: `inset 0 0 0 1px ${delta.good ? t.good : t.bad}33`,
              }}
            >
              {delta.pct >= 0 ? <ArrowUpwardRoundedIcon sx={{ fontSize: 13 }} /> : <ArrowDownwardRoundedIcon sx={{ fontSize: 13 }} />}
              {Math.abs(delta.pct * 100).toFixed(1)}%
            </Box>
          </Tooltip>
        )}
      </Box>
      {error ? (
        <Typography color="error" variant="body2">{error}</Typography>
      ) : value === undefined ? (
        <Skeleton width="60%" height={50} />
      ) : (
        <Typography
          sx={{
            fontFamily: t.mono, fontSize: { xs: '1.35rem', md: '1.95rem' }, fontWeight: 700, mt: 1.25, color: t.textPrimary, letterSpacing: '-0.02em',
            textShadow: t.glow ? `0 0 28px ${alpha(colour, 0.45)}` : 'none', whiteSpace: 'nowrap', position: 'relative', zIndex: 1,
          }}
        >
          <AnimatedNumber value={Number(value ?? 0)} format={format} />
        </Typography>
      )}
      <Typography sx={{ fontSize: '0.7rem', color: t.textMuted, minHeight: 16 }}>{delta ? 'vs previous period' : ' '}</Typography>
      <Box sx={{ mx: -2.25, mt: 0.25 }}>
        {dateDim && trend.rows && trend.rows.length > 1 && <Sparkline rows={trend.rows} measure={item.measure} dateDim={dateDim} format={format} colour={colour} />}
      </Box>
    </Paper>
  );
}

export default function KpiRow({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: `repeat(${visual.items?.length ?? 1}, minmax(0, 1fr))` }, gap: 2 }}>
      {visual.items?.map((item, i) => <Tile key={item.label} index={i} reportId={reportId} spec={spec} item={item} base={base} />)}
    </Box>
  );
}
