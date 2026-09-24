import { Box, Paper, Skeleton, Typography } from '@mui/material';
import { KpiItem, QueryRequest, Spec, Visual } from '../api';
import { formatValue } from '../format';
import { useQuery } from '../useQuery';

type Base = Omit<QueryRequest, 'measures'>;

/** A KPI's own include list narrows the user's filter (intersection); its exclude list is added on top. */
function requestFor(item: KpiItem, base: Base): QueryRequest | null {
  const filters: Record<string, string[]> = { ...(base.filters ?? {}) };
  for (const [dim, only] of Object.entries(item.include ?? {})) {
    const chosen = filters[dim] ?? [];
    const narrowed = chosen.length ? chosen.filter((v) => only.includes(v)) : only;
    if (narrowed.length === 0) return null; // the user filtered this slice out entirely
    filters[dim] = narrowed;
  }
  return { ...base, filters, exclude: item.exclude, groupBy: [], measures: [item.measure] };
}

function Tile({ reportId, spec, item, base }: { reportId: string; spec: Spec; item: KpiItem; base: Base }) {
  const request = requestFor(item, base);
  const { rows, error } = useQuery(reportId, request);
  const format = spec.measures[item.measure]?.format;
  const value = request === null ? 0 : rows?.[0]?.[item.measure];

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {item.label}
      </Typography>
      {error ? (
        <Typography color="error" variant="body2">{error}</Typography>
      ) : value === undefined ? (
        <Skeleton width="60%" height={40} />
      ) : (
        <Typography sx={{ fontSize: '1.7rem', fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>
          {formatValue(value ?? 0, format)}
        </Typography>
      )}
    </Paper>
  );
}

export default function KpiRow({ reportId, spec, visual, base }: { reportId: string; spec: Spec; visual: Visual; base: Base }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: `repeat(${visual.items?.length ?? 1}, 1fr)` }, gap: 2, mb: 2 }}>
      {visual.items?.map((item) => <Tile key={item.label} reportId={reportId} spec={spec} item={item} base={base} />)}
    </Box>
  );
}
