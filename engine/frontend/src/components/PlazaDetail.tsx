import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, IconButton, Skeleton, Table, TableBody, TableCell, TableHead, TableRow,
  Typography, useMediaQuery,
} from '@mui/material';
import { alpha, Theme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import { KpiItem, QueryRequest, Spec } from '../api';
import { formatCompactCurrency, formatDay, formatValue } from '../format';
import { useQuery } from '../useQuery';
import { chartTheme, useTokens } from '../theme';
import { requestFor } from './KpiRow';

type Base = Omit<QueryRequest, 'measures'>;

/** Only the `plaza` dimension opens the plaza popup. */
export const PLAZA_DIM = 'plaza';

/** Set by ReportPage when its report has a plaza dimension; visuals call it to open the plaza popup. */
export const PlazaContext = createContext<((name: string) => void) | null>(null);
export const usePlazaOpener = () => useContext(PlazaContext);

/** A plaza name that opens its popup when clicked (plain text when the page has no popup). */
export function PlazaLink({ name, children }: { name: string; children?: ReactNode }) {
  const t = useTokens();
  const open = usePlazaOpener();
  if (!open || name === '(Blank)') return <>{children ?? name}</>;
  return (
    <ButtonBase
      disableRipple
      onClick={(e) => { e.stopPropagation(); open(name); }}
      aria-label={`Open plaza ${name}`}
      title={`Open plaza ${name}`}
      sx={{
        font: 'inherit', color: 'inherit', textAlign: 'left', verticalAlign: 'baseline', borderRadius: '5px', px: 0.5, mx: -0.5,
        textDecoration: 'underline dotted', textDecorationColor: alpha(t.textMuted, 0.6), textUnderlineOffset: '3px',
        transition: 'color .15s ease, background-color .15s ease',
        '&:hover': { color: t.accent, bgcolor: alpha(t.accent, 0.1), textDecoration: 'underline', textDecorationColor: t.accent },
        '&.Mui-focusVisible': { outline: `2px solid ${t.accent}`, outlineOffset: 1 },
      }}
    >
      {children ?? name}
    </ButtonBase>
  );
}

/** Ids like wtd_sales / sales_mtd are running totals; the daily trend uses their plain measure (sales) when the report has it. */
function plainMeasure(spec: Spec, id: string): string {
  const m = id.match(/^(?:wtd|ptd|mtd|ytd)_(.+)$/) ?? id.match(/^(.+)_(?:wtd|ptd|mtd|ytd)$/);
  return m && spec.measures[m[1]] ? m[1] : id;
}

function MiniKpi({ reportId, spec, item, base, index }: { reportId: string; spec: Spec; item: KpiItem; base: Base; index: number }) {
  const t = useTokens();
  const request = requestFor(item, base, []);
  const { rows, error } = useQuery(reportId, request);
  const value = request === null ? 0 : rows?.[0]?.[item.measure];
  const colour = t.palette[index % t.palette.length];
  return (
    <Box
      sx={{
        position: 'relative', overflow: 'hidden', px: 1.5, py: 1.1, borderRadius: '12px', border: `1px solid ${t.panelBorder}`,
        bgcolor: t.mode === 'light' ? '#f8fafc' : 'rgba(148,163,184,0.05)',
        animation: 'plazaRise .45s ease both', animationDelay: `${index * 60}ms`,
        '@keyframes plazaRise': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        '&::before': { content: '""', position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 3, bgcolor: colour, boxShadow: t.glow ? `0 0 8px ${colour}` : 'none' },
      }}
    >
      <Typography sx={{ fontSize: '0.66rem', fontWeight: 650, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textSecondary, lineHeight: 1.3 }}>
        {item.label}
      </Typography>
      {error ? (
        <Typography color="error" sx={{ fontSize: '0.75rem' }}>{error}</Typography>
      ) : value === undefined ? (
        <Skeleton width="70%" height={28} />
      ) : (
        <Typography sx={{ fontFamily: t.mono, fontSize: '1.15rem', fontWeight: 700, color: t.textPrimary, whiteSpace: 'nowrap', mt: 0.25 }}>
          {value === null ? <Box component="span" sx={{ color: t.textMuted }}>–</Box> : formatValue(value, spec.measures[item.measure]?.format)}
        </Typography>
      )}
    </Box>
  );
}

function BrandTable({ reportId, spec, base, measures }: { reportId: string; spec: Spec; base: Base; measures: string[] }) {
  const t = useTokens();
  const byBrand = !!spec.dimensions.brand;
  const rowsQuery = useQuery(reportId, byBrand ? { ...base, groupBy: ['brand'], measures } : null);
  const totalQuery = useQuery(reportId, { ...base, groupBy: [], measures });
  const fmt = (m: string, v: unknown) => formatValue(v, spec.measures[m]?.format);
  return (
    <Box sx={{ overflowX: 'auto', border: `1px solid ${t.panelBorder}`, borderRadius: '12px' }}>
      <Table size="small" sx={{ '& th, & td': { px: 1, whiteSpace: 'nowrap' }, '& th:first-of-type, & td:first-of-type': { pl: 1.5 } }}>
        <TableHead>
          <TableRow>
            <TableCell>{byBrand ? spec.dimensions.brand.label : ''}</TableCell>
            {measures.map((m) => <TableCell key={m} align="right">{spec.measures[m]?.label ?? m}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {byBrand && rowsQuery.loading && [0, 1, 2].map((i) => (
            <TableRow key={i}><TableCell colSpan={measures.length + 1}><Skeleton /></TableCell></TableRow>
          ))}
          {byBrand && rowsQuery.rows?.length === 0 && (
            <TableRow><TableCell colSpan={measures.length + 1} sx={{ color: t.textMuted }}>No rows for this plaza in the selected dates.</TableCell></TableRow>
          )}
          {rowsQuery.rows?.map((r, i) => (
            <TableRow key={i} hover>
              <TableCell sx={{ fontWeight: 500 }}>{r.brand ?? '(Blank)'}</TableCell>
              {measures.map((m) => <TableCell key={m} align="right" sx={{ fontFamily: t.mono, fontSize: '0.8rem' }}>{fmt(m, r[m])}</TableCell>)}
            </TableRow>
          ))}
          {totalQuery.rows?.[0] && (
            <TableRow sx={{ '& td': { fontWeight: 700, bgcolor: t.headerCell, borderTop: `1px solid ${t.panelBorder}` } }}>
              <TableCell>Total</TableCell>
              {measures.map((m) => (
                <TableCell key={m} align="right" sx={{ fontFamily: t.mono, fontSize: '0.8rem', color: t.accent }}>{fmt(m, totalQuery.rows![0][m])}</TableCell>
              ))}
            </TableRow>
          )}
        </TableBody>
      </Table>
      {(rowsQuery.error || totalQuery.error) && <Typography color="error" sx={{ p: 1, fontSize: '0.8rem' }}>{rowsQuery.error ?? totalQuery.error}</Typography>}
    </Box>
  );
}

function Trend({ reportId, spec, base, item, dateDim }: { reportId: string; spec: Spec; base: Base; item: KpiItem; dateDim: string }) {
  const t = useTokens();
  const c = chartTheme(t);
  const measure = plainMeasure(spec, item.measure);
  const { rows, error } = useQuery(reportId, requestFor({ ...item, measure }, base, [dateDim]));
  const format = spec.measures[measure]?.format;
  if (error) return <Typography color="error" sx={{ fontSize: '0.8rem' }}>{error}</Typography>;
  if (!rows) return <Skeleton variant="rectangular" height={150} sx={{ borderRadius: '10px' }} />;
  const points = rows.filter((r) => r[dateDim] != null).sort((a, b) => (String(a[dateDim]) < String(b[dateDim]) ? -1 : 1));
  if (points.length < 2) {
    return <Typography sx={{ fontSize: '0.8rem', color: t.textMuted, py: 2 }}>Only one point in this range, so there is no trend to draw.</Typography>;
  }
  const option = {
    grid: { left: 4, right: 12, top: 10, bottom: 2, containLabel: true },
    tooltip: {
      trigger: 'axis', ...c.tooltip,
      formatter: (p: { name: string; value: number }[]) => `${formatDay(p[0].name)}<br/><b>${formatValue(p[0].value, format)}</b>`,
    },
    xAxis: {
      type: 'category', boundaryGap: false, data: points.map((r) => String(r[dateDim]).slice(0, 10)),
      axisLabel: { color: c.axisText, fontSize: 10, formatter: (v: string) => formatDay(v).replace(/^\w+, /, '') },
      axisLine: { lineStyle: { color: c.grid } }, axisTick: { show: false },
    },
    yAxis: {
      type: 'value', splitNumber: 3,
      axisLabel: { color: c.axisText, fontSize: 10, formatter: (v: number) => (format === 'currency' ? formatCompactCurrency(v) : String(v)) },
      splitLine: { lineStyle: { color: c.grid } },
    },
    series: [{
      type: 'line', data: points.map((r) => Number(r[measure] ?? 0)), smooth: 0.35, showSymbol: points.length <= 12, symbolSize: 6,
      lineStyle: { width: 2.25, color: t.accent, shadowColor: t.glow || 'transparent', shadowBlur: t.glow ? 10 : 0 },
      itemStyle: { color: t.accent, borderColor: t.panelSolid, borderWidth: 2 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: `${c.series1Light}40` }, { offset: 1, color: `${c.series1Light}00` }] } },
      animationDuration: 1000, animationEasing: 'cubicOut',
    }],
  };
  return <ReactECharts option={option} style={{ height: 160 }} notMerge />;
}

type Props = {
  reportId: string;
  spec: Spec;
  /** The page's current filters and dates. */
  base: Base;
  /** The dates for the trend (retail-week reports show the last weeks up to the selected one). */
  trendBase: Base & { label: string };
  rangeLabel: string;
  plaza: string | null;
  onClose: () => void;
  /** Sets the page's Plaza filter to this plaza (not given when the page has no Plaza filter). */
  onFilter?: (plaza: string) => void;
};

/** "Plaza · <name>": the report's KPIs, a breakdown by brand and a daily trend, for one plaza on top of the page's filters. */
export default function PlazaDetail({ reportId, spec, base, trendBase, rangeLabel, plaza, onClose, onFilter }: Props) {
  const t = useTokens();
  const phone = useMediaQuery((th: Theme) => th.breakpoints.down('sm'));
  // Keep the last plaza while the dialog fades out.
  const [shown, setShown] = useState<string | null>(plaza);
  useEffect(() => { if (plaza) setShown(plaza); }, [plaza]);
  const name = plaza ?? shown;

  const kpi = spec.visuals.find((v) => v.type === 'kpi')?.items?.filter((i) => spec.measures[i.measure]);
  const items: KpiItem[] = kpi?.length
    ? kpi
    : Object.keys(spec.measures).slice(0, 4).map((m) => ({ label: spec.measures[m].label, measure: m }));
  const main = spec.visuals.find((v) => v.type === 'table' || v.type === 'matrix');
  let measures = (main?.values ?? []).filter((m) => spec.measures[m]);
  if (measures.length < 2) measures = [...new Set([...measures, ...items.map((i) => i.measure)])];
  measures = measures.slice(0, 6);
  const dateDim = Object.entries(spec.dimensions).find(([, d]) => d.type === 'date')?.[0];

  const withPlaza = (b: Base): Base => ({ ...b, filters: { ...(b.filters ?? {}), [PLAZA_DIM]: name ? [name] : [] } });
  const pBase = withPlaza(base);
  const trendLabel = trendBase.label;
  const firstMeasure = items[0] && plainMeasure(spec, items[0].measure);

  const section = (title: string, extra?: string) => (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.75, mt: 2, flexWrap: 'wrap' }}>
      <Typography variant="h2">{title}</Typography>
      {extra && <Typography sx={{ fontSize: '0.72rem', color: t.textMuted }}>{extra}</Typography>}
    </Box>
  );

  return (
    <Dialog
      open={!!plaza}
      onClose={onClose}
      fullScreen={phone}
      maxWidth="md"
      fullWidth
      aria-labelledby="plaza-detail-title"
      PaperProps={{
        sx: {
          bgcolor: t.panelSolid, backgroundImage: 'none', backdropFilter: 'none', borderRadius: phone ? 0 : '18px',
          '&:hover': { borderColor: t.panelBorder },
        },
      }}
    >
      {name && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: { xs: 2, sm: 2.5 }, pt: 2, pb: 1, borderBottom: `1px solid ${t.panelBorder}` }}>
            <Box
              sx={{
                width: 34, height: 34, borderRadius: '10px', display: 'grid', placeItems: 'center', flexShrink: 0, color: '#fff',
                background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})`, boxShadow: t.glow ? `0 0 16px ${t.glow}` : `0 6px 16px -6px ${alpha(t.accent, 0.6)}`,
              }}
            >
              <StorefrontRoundedIcon sx={{ fontSize: 19 }} />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography id="plaza-detail-title" sx={{ fontWeight: 750, fontSize: '1.1rem', color: t.textPrimary, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <Box component="span" sx={{ color: t.textMuted, fontWeight: 600 }}>Plaza · </Box>{name}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: t.textSecondary, fontFamily: t.mono }}>{rangeLabel} · with the page's other filters</Typography>
            </Box>
            <IconButton aria-label="Close" onClick={onClose} size="small"><CloseRoundedIcon /></IconButton>
          </Box>
          <DialogContent sx={{ px: { xs: 2, sm: 2.5 }, pt: 0.5 }}>
            {section('Key figures')}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: `repeat(${items.length <= 5 ? items.length : items.length === 6 ? 3 : 4}, minmax(0, 1fr))` }, gap: 1 }}>
              {items.map((item, i) => <MiniKpi key={item.label} index={i} reportId={reportId} spec={spec} item={item} base={pBase} />)}
            </Box>

            {section(spec.dimensions.brand ? `By ${spec.dimensions.brand.label.toLowerCase()}` : 'Totals')}
            <BrandTable reportId={reportId} spec={spec} base={pBase} measures={measures} />

            {dateDim && items[0] && (
              <>
                {section(`${spec.measures[firstMeasure]?.label ?? items[0].label} by ${spec.dimensions[dateDim].label.toLowerCase()}`, trendLabel)}
                <Trend reportId={reportId} spec={spec} base={withPlaza(trendBase)} item={items[0]} dateDim={dateDim} />
              </>
            )}
          </DialogContent>
          <DialogActions sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5, borderTop: `1px solid ${t.panelBorder}`, gap: 1, flexWrap: 'wrap' }}>
            <Button onClick={onClose} sx={{ color: t.textSecondary }}>Close</Button>
            {onFilter && (
              <Button
                variant="contained"
                startIcon={<FilterAltRoundedIcon />}
                onClick={() => { onFilter(name); onClose(); }}
                sx={{
                  color: t.mode === 'light' ? '#fff' : t.bg, background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})`, boxShadow: 'none',
                  '&:hover': { boxShadow: `0 6px 18px -6px ${alpha(t.accent, 0.7)}` },
                }}
              >
                Filter the page to this plaza
              </Button>
            )}
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
