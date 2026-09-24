import { useState } from 'react';
import {
  Box, Paper, Skeleton, Table, TableBody, TableCell, TableHead, TableRow, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import { QueryRequest, Spec, Visual } from '../api';
import { formatValue } from '../format';
import { tokens } from '../theme';
import { useQuery } from '../useQuery';

type Base = Omit<QueryRequest, 'measures'>;

/**
 * A grouped table with an optional total row. Values can be measures or calculations; a calculation with
 * several modes (like % to Total) gets a toggle so old and corrected numbers can be compared.
 */
export default function SummaryTable({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  const values = visual.values ?? [];
  const measures = values.filter((v) => spec.measures[v]);
  const calcIds = values.filter((v) => spec.calculations[v]);
  const [modes, setModes] = useState<Record<string, string>>(
    Object.fromEntries(calcIds.map((c) => [c, spec.calculations[c].default_mode])),
  );
  const neededMeasures = Array.from(new Set([...measures, ...calcIds.map((c) => spec.calculations[c].of)]));

  const rowsQuery = useQuery(reportId, { ...base, groupBy: visual.rows, measures: neededMeasures, calculations: modes });
  const totalQuery = useQuery(reportId, visual.total_row ? { ...base, groupBy: [], measures: neededMeasures, calculations: modes } : null);

  const label = (id: string) => spec.measures[id]?.label ?? spec.calculations[id]?.label ?? id;
  const format = (id: string) => spec.measures[id]?.format ?? spec.calculations[id]?.format;
  const rowDims = visual.rows ?? [];
  const maxOf: Record<string, number> = Object.fromEntries(
    measures.map((m) => [m, Math.max(0, ...(rowsQuery.rows ?? []).map((r) => Number(r[m] ?? 0)))]),
  );

  return (
    <Paper sx={{ p: 2, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <Typography variant="h2">{visual.title}</Typography>
        {calcIds.map((c) => (
          <ToggleButtonGroup
            key={c}
            size="small"
            exclusive
            value={modes[c]}
            onChange={(_, m) => m && setModes({ ...modes, [c]: m })}
            aria-label={`${label(c)} mode`}
          >
            {Object.entries(spec.calculations[c].modes).map(([id, m]) => (
              <ToggleButton key={id} value={id} sx={{ textTransform: 'none', py: 0.25 }}>
                {m.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        ))}
      </Box>
      <Box sx={{ maxHeight: 440, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
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
              <TableRow key={i} hover>
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
                            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', height: 18, borderRadius: '4px',
                            width: `calc(${(share * 100).toFixed(1)}% - 16px)`, minWidth: 2,
                            background: 'linear-gradient(90deg, rgba(57,135,229,0.10), rgba(56,189,248,0.32))',
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
              <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.primary', bgcolor: '#0d1422', position: 'sticky', bottom: 0, borderTop: `1px solid ${tokens.panelBorder}` } }}>
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
      {calcIds.map((c) =>
        modes[c] === 'legacy' ? (
          <Tooltip key={c} title="In the current Power BI report, non-cash rows are divided by the total without cash, so the column does not add up to 100%.">
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Showing {label(c)} exactly as Power BI calculates it today (does not add up to 100%).
            </Typography>
          </Tooltip>
        ) : null,
      )}
      {(rowsQuery.error || totalQuery.error) && <Typography color="error">{rowsQuery.error ?? totalQuery.error}</Typography>}
    </Paper>
  );
}
