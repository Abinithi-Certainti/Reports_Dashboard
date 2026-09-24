import { useEffect, useState } from 'react';
import { Autocomplete, Box, Button, Paper, TextField } from '@mui/material';
import { api, Spec } from '../api';

export type FilterState = {
  values: Record<string, string[]>;
  dateFrom: string;
  dateTo: string;
  minDate: string;
  maxDate: string;
};

type Props = {
  reportId: string;
  spec: Spec;
  value: FilterState;
  onChange: (v: FilterState) => void;
  onReset: () => void;
};

/** All filters in one row above the visuals. An empty dropdown means "All". */
export default function FilterBar({ reportId, spec, value, onChange, onReset }: Props) {
  const [options, setOptions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    spec.filters
      .filter((f) => f.type === 'multi_select')
      .forEach((f) =>
        api.values(reportId, f.dimension).then((vals) => setOptions((o) => ({ ...o, [f.dimension]: vals.map(String) }))),
      );
  }, [reportId, spec]);

  return (
    <Paper sx={{ p: 2, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
      {spec.filters.map((f) =>
        f.type === 'multi_select' ? (
          <Autocomplete
            key={f.dimension}
            multiple
            size="small"
            limitTags={1}
            options={options[f.dimension] ?? []}
            value={value.values[f.dimension] ?? []}
            onChange={(_, selected) => onChange({ ...value, values: { ...value.values, [f.dimension]: selected } })}
            sx={{ width: 220 }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={spec.dimensions[f.dimension].label}
                placeholder={(value.values[f.dimension] ?? []).length ? '' : 'All'}
                InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
              />
            )}
          />
        ) : (
          <Box key={f.dimension} sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              type="date"
              label="From"
              value={value.dateFrom}
              inputProps={{ min: value.minDate, max: value.dateTo }}
              onChange={(e) => e.target.value && onChange({ ...value, dateFrom: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              size="small"
              type="date"
              label="To"
              value={value.dateTo}
              inputProps={{ min: value.dateFrom, max: value.maxDate }}
              onChange={(e) => e.target.value && onChange({ ...value, dateTo: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        ),
      )}
      <Box sx={{ flex: 1 }} />
      <Button onClick={onReset}>Reset filters</Button>
    </Paper>
  );
}
