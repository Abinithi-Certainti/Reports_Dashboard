import { Fragment, useMemo, useState } from 'react';
import { Box, Button, IconButton, Paper, Skeleton, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { QueryRequest, Row, Spec, Visual } from '../api';
import { formatDay, formatValue } from '../format';
import { useQuery } from '../useQuery';
import { tokens } from '../theme';

type Base = Omit<QueryRequest, 'measures'>;

/** A node in the row tree. Leaves sit at the last row dimension; every node carries per-column totals. */
type Node = { key: string; label: string; depth: number; cells: Map<string, number>; total: number; children: Node[] };

function buildTree(rows: Row[], rowDims: string[], colDim: string, measure: string): { roots: Node[]; columns: string[]; grand: Node } {
  const columns = Array.from(new Set(rows.map((r) => String(r[colDim])))).sort();
  const grand: Node = { key: '', label: 'Total', depth: -1, cells: new Map(), total: 0, children: [] };
  for (const r of rows) {
    const col = String(r[colDim]);
    const value = Number(r[measure] ?? 0);
    let node = grand;
    node.cells.set(col, (node.cells.get(col) ?? 0) + value);
    node.total += value;
    rowDims.forEach((d, depth) => {
      const label = r[d] === null || r[d] === undefined ? '(Blank)' : String(r[d]);
      const key = `${node.key}/${label}`;
      let child = node.children.find((c) => c.key === key); // rows arrive sorted, so first-seen order is the sort order
      if (!child) {
        child = { key, label, depth, cells: new Map(), total: 0, children: [] };
        node.children.push(child);
      }
      child.cells.set(col, (child.cells.get(col) ?? 0) + value);
      child.total += value;
      node = child;
    });
  }
  return { roots: grand.children, columns, grand };
}

function allKeys(nodes: Node[], out: string[] = []): string[] {
  nodes.forEach((n) => {
    if (n.children.length) {
      out.push(n.key);
      allKeys(n.children, out);
    }
  });
  return out;
}

export default function MatrixVisual({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  const rowDims = visual.rows ?? [];
  const colDim = visual.columns?.[0] ?? '';
  const measure = visual.values?.[0] ?? '';
  const format = spec.measures[measure]?.format;
  const { rows, error } = useQuery(reportId, { ...base, groupBy: [...rowDims, colDim], measures: [measure] });

  const tree = useMemo(() => (rows ? buildTree(rows, rowDims, colDim, measure) : undefined), [rows, rowDims, colDim, measure]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const cell = (n: number | undefined) => (n === undefined ? '' : formatValue(n, format));
  const firstColSx = { position: 'sticky', left: 0, zIndex: 1, bgcolor: '#0d1422', minWidth: 240, whiteSpace: 'nowrap' } as const;
  // Heat shading for leaf cells: one hue, stronger = bigger (sequential, never a rainbow).
  const leafMax = useMemo(() => (rows ? Math.max(1, ...rows.map((r) => Number(r[measure] ?? 0))) : 1), [rows, measure]);
  const heat = (v: number | undefined) => (v === undefined || v <= 0 ? 'transparent' : `rgba(56,189,248,${(0.04 + 0.30 * Math.min(1, v / leafMax)).toFixed(3)})`);

  const renderNode = (n: Node): JSX.Element => {
    const isOpen = !collapsed.has(n.key);
    const hasChildren = n.children.length > 0;
    const weight = n.depth < rowDims.length - 1 ? 650 : 400;
    return (
      <Fragment key={n.key}>
        <TableRow hover>
          <TableCell sx={{ ...firstColSx, pl: 1 + n.depth * 2.5, fontWeight: weight }}>
            {hasChildren ? (
              <IconButton size="small" onClick={() => toggle(n.key)} aria-label={isOpen ? `Collapse ${n.label}` : `Expand ${n.label}`} sx={{ mr: 0.5, p: 0.25 }}>
                <Box component="span" sx={{ fontSize: 12, width: 14, display: 'inline-block' }}>{isOpen ? '▾' : '▸'}</Box>
              </IconButton>
            ) : (
              <Box component="span" sx={{ display: 'inline-block', width: 26 }} />
            )}
            {n.label}
          </TableCell>
          {tree!.columns.map((c) => (
            <TableCell
              key={c}
              align="right"
              sx={{
                fontWeight: weight, fontFamily: tokens.mono, fontSize: '0.78rem', whiteSpace: 'nowrap',
                bgcolor: hasChildren ? 'transparent' : heat(n.cells.get(c)),
                color: hasChildren ? tokens.textPrimary : tokens.textPrimary,
              }}
            >
              {cell(n.cells.get(c))}
            </TableCell>
          ))}
          <TableCell align="right" sx={{ fontWeight: 650, fontFamily: tokens.mono, fontSize: '0.78rem', whiteSpace: 'nowrap', bgcolor: '#0d1422', color: tokens.accent }}>
            {cell(n.total)}
          </TableCell>
        </TableRow>
        {hasChildren && isOpen && n.children.map(renderNode)}
      </Fragment>
    );
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h2">{visual.title}</Typography>
        {tree && (
          <Box>
            <Button size="small" onClick={() => setCollapsed(new Set())}>Expand all</Button>
            <Button size="small" onClick={() => setCollapsed(new Set(allKeys(tree.roots)))}>Collapse all</Button>
          </Box>
        )}
      </Box>
      {error && <Typography color="error">{error}</Typography>}
      {!tree ? (
        <Skeleton variant="rectangular" height={300} />
      ) : (
        <Box sx={{ overflow: 'auto', maxHeight: 620 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...firstColSx, zIndex: 3 }}>{rowDims.map((d) => spec.dimensions[d].label).join(' › ')}</TableCell>
                {tree.columns.map((c) => (
                  <TableCell key={c} align="right" sx={{ whiteSpace: 'nowrap' }}>{formatDay(c)}</TableCell>
                ))}
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tree.roots.map(renderNode)}
              <TableRow sx={{ '& td': { fontWeight: 700, borderTop: `1px solid ${tokens.accent}`, fontFamily: tokens.mono, fontSize: '0.78rem', color: tokens.accent } }}>
                <TableCell sx={{ ...firstColSx, color: tokens.accent }}>Total</TableCell>
                {tree.columns.map((c) => (
                  <TableCell key={c} align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{cell(tree.grand.cells.get(c))}</TableCell>
                ))}
                <TableCell align="right" sx={{ whiteSpace: 'nowrap', bgcolor: '#0d1422' }}>{cell(tree.grand.total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
      )}
    </Paper>
  );
}
