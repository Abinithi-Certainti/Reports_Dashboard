import { Box, Paper, Skeleton, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { QueryRequest, Spec, Visual } from '../api';
import { formatValue } from '../format';
import { useQuery } from '../useQuery';
import { useTokens } from '../theme';
import { PlazaLink } from './PlazaDetail';

type Base = Omit<QueryRequest, 'measures'>;

/**
 * A grid of rows[0] × columns[0] (e.g. plaza × category) coloured by one value (e.g. waste % of COGS): the darker
 * the cell, the higher the value, so the problem spots stand out. Wide grids scroll sideways inside the panel.
 */
export default function HeatmapVisual({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  const t = useTokens();
  const rowDim = visual.rows?.[0] ?? '';
  const colDim = visual.columns?.[0] ?? '';
  const measure = visual.values?.[0] ?? '';
  const format = spec.measures[measure]?.format;
  const { rows, error } = useQuery(reportId, { ...base, groupBy: [rowDim, colDim], measures: [measure] });

  const label = (v: unknown) => (v === null || v === undefined || v === '' ? '(Blank)' : String(v));
  const rowNames = [...new Set((rows ?? []).map((r) => label(r[rowDim])))];
  const colNames = [...new Set((rows ?? []).map((r) => label(r[colDim])))].sort();
  const cell = new Map((rows ?? []).map((r) => [`${label(r[rowDim])}|${label(r[colDim])}`, r[measure] === null ? null : Number(r[measure])]));
  const values = [...cell.values()].filter((v): v is number => v !== null && Number.isFinite(v));
  const max = Math.max(0, ...values);
  const hot = t.bad;

  return (
    <Paper sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h2" sx={{ mb: 1 }}>{visual.title}</Typography>
      {error && <Typography color="error">{error}</Typography>}
      {!rows ? <Skeleton variant="rectangular" height={260} /> : (
        <Box sx={{ overflow: 'auto', maxHeight: 560 }}>
          <Box
            component="table"
            sx={{
              borderCollapse: 'separate', borderSpacing: '3px', width: '100%', minWidth: 120 + colNames.length * 84,
              '& th': { fontSize: '0.68rem', color: t.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', p: 0.5, position: 'sticky', top: 0, background: t.panelSolid, zIndex: 1 },
              '& td': { fontFamily: t.mono, fontSize: '0.76rem', fontWeight: 600, textAlign: 'center', borderRadius: '6px', p: 0.75, fontVariantNumeric: 'tabular-nums', transition: 'transform .15s ease' },
              '& td:hover': { transform: 'scale(1.06)' },
              '& td.name, & th.name': { textAlign: 'left', fontFamily: 'inherit', fontWeight: 500, color: t.textPrimary, whiteSpace: 'nowrap', background: 'none' },
            }}
          >
            <thead><tr><th className="name">{spec.dimensions[rowDim]?.label}</th>{colNames.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {rowNames.map((rn) => (
                <tr key={rn}>
                  <td className="name">{rowDim === 'plaza' && rn !== '(Blank)' ? <PlazaLink name={rn} /> : rn}</td>
                  {colNames.map((cn) => {
                    const v = cell.get(`${rn}|${cn}`) ?? null;
                    const k = v === null || max === 0 ? 0 : Math.max(0, v) / max;
                    return (
                      <Tooltip key={cn} title={`${rn} · ${cn}: ${v === null ? 'no data' : formatValue(v, format)}`}>
                        <td style={{ background: v === null ? 'transparent' : alpha(hot, 0.08 + k * 0.72), color: k > 0.6 ? '#fff' : t.textPrimary }}>
                          {v === null ? '–' : formatValue(v, format)}
                        </td>
                      </Tooltip>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>
      )}
      <Typography sx={{ fontSize: '0.72rem', color: t.textMuted, mt: 1 }}>Darker = higher. “–” = no data for that pair.</Typography>
    </Paper>
  );
}
