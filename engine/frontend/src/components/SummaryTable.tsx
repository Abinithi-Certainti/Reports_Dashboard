import { Box, Paper, Skeleton, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { QueryRequest, Spec, Visual } from '../api';
import { formatValue } from '../format';
import { useTokens } from '../theme';
import { useQuery } from '../useQuery';

type Base = Omit<QueryRequest, 'measures'>;

/** A grouped table with an optional total row. It shows every row: its panel grows to fit (no inner scrollbar). */
export default function SummaryTable({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  const tokens = useTokens();
  const values = (visual.values ?? []).filter((v) => spec.measures[v]);
  const measures = values;

  const rowsQuery = useQuery(reportId, { ...base, groupBy: visual.rows, measures });
  const totalQuery = useQuery(reportId, visual.total_row ? { ...base, groupBy: [], measures } : null);

  const label = (id: string) => spec.measures[id]?.label ?? id;
  const format = (id: string) => spec.measures[id]?.format;
  const rowDims = visual.rows ?? [];
  // Half-width (or narrower) tables with many values get smaller cells so they fit without scrolling sideways.
  const narrow = (visual.span ?? 5) < 12 && rowDims.length + values.length > 4;
  const maxOf: Record<string, number> = Object.fromEntries(
    measures.map((m) => [m, Math.max(0, ...(rowsQuery.rows ?? []).map((r) => Number(r[m] ?? 0)))]),
  );

  return (
    <Paper sx={{ p: 1.5, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h2" sx={{ mb: 1 }}>{visual.title}</Typography>
      {/* Wide tables may scroll sideways on narrow screens; never up and down. */}
      <Box sx={{ overflowX: 'auto', overflowY: 'hidden' }}>
        {/* Tight cells so wide tables (ten or more values) still fit their panel. */}
        <Table
          size="small"
          sx={{
            '& th, & td': { px: narrow ? 0.75 : 1 }, '& th:first-of-type, & td:first-of-type': { pl: narrow ? 1 : 1.5 }, '& td': { whiteSpace: 'nowrap' },
            ...(narrow && { '& td': { whiteSpace: 'nowrap', fontSize: '0.76rem !important' }, '& th': { fontSize: '0.66rem' } }),
          }}
        >
          <TableHead>
            <TableRow>
              {rowDims.map((d) => <TableCell key={d}>{spec.dimensions[d].label}</TableCell>)}
              {values.map((v) => <TableCell key={v} align="right">{label(v)}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            {rowsQuery.loading &&
              [0, 1, 2, 3].map((i) => (
                <TableRow key={i}><TableCell colSpan={rowDims.length + values.length}><Skeleton /></TableCell></TableRow>
              ))}
            {rowsQuery.rows?.map((r, i) => (
              <TableRow
                key={i}
                hover
                sx={{
                  animation: 'rowIn .45s ease both', animationDelay: `${i * 40}ms`,
                  '@keyframes rowIn': { from: { opacity: 0, transform: 'translateX(-6px)' }, to: { opacity: 1, transform: 'none' } },
                  '&:nth-of-type(even)': { bgcolor: tokens.mode === 'light' ? 'rgba(15,23,42,0.018)' : 'rgba(148,163,184,0.03)' },
                  '& td:first-of-type': { boxShadow: 'inset 3px 0 0 transparent', transition: 'box-shadow .2s ease' },
                  '&:hover td:first-of-type': { boxShadow: `inset 3px 0 0 ${tokens.accent}` },
                }}
              >
                {rowDims.map((d) => <TableCell key={d} sx={{ fontWeight: 500 }}>{r[d] ?? '(Blank)'}</TableCell>)}
                {values.map((v) => {
                  const isBar = v === measures[0] && maxOf[v] > 0;
                  const share = isBar ? Math.max(0, Number(r[v] ?? 0)) / maxOf[v] : 0;
                  return (
                    <TableCell key={v} align="right" sx={{ fontFamily: tokens.mono, fontSize: '0.82rem', position: 'relative' }}>
                      {isBar && (
                        <Box
                          aria-hidden
                          sx={{
                            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', height: 20, borderRadius: '6px',
                            width: `calc(${(share * 100).toFixed(1)}% - 16px)`, minWidth: 2,
                            background: `linear-gradient(90deg, ${tokens.series1}10, ${tokens.series1Light}${tokens.mode === 'light' ? '33' : '4d'}, ${tokens.accent2}${tokens.mode === 'light' ? '40' : '66'})`,
                            transition: 'width .6s ease',
                          }}
                        />
                      )}
                      <Box component="span" sx={{ position: 'relative' }}>{formatValue(r[v], format(v))}</Box>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
          {visual.total_row && totalQuery.rows?.[0] && (
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.primary', bgcolor: tokens.headerCell, borderTop: `1px solid ${tokens.panelBorder}` } }}>
                <TableCell colSpan={rowDims.length}>Total</TableCell>
                {values.map((v) => (
                  <TableCell key={v} align="right" sx={{ fontFamily: tokens.mono, color: tokens.accent }}>
                    {formatValue(totalQuery.rows![0][v], format(v))}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
          )}
        </Table>
      </Box>
      {(rowsQuery.error || totalQuery.error) && <Typography color="error">{rowsQuery.error ?? totalQuery.error}</Typography>}
    </Paper>
  );
}
