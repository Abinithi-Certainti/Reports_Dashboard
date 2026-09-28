import { useEffect, useState } from 'react';
import { Autocomplete, Box, Button, MenuItem, Paper, TextField } from '@mui/material';
import { api, RetailWeek, Spec } from '../api';
import { useSound } from '../sound';

export type FilterState = {
  values: Record<string, string[]>;
  dateFrom: string;
  dateTo: string;
  minDate: string;
  maxDate: string;
  weeks?: RetailWeek[]; // the retail weeks that overlap the data, oldest first (retail_week filter only)
};

/** The retail weeks that overlap the data, oldest first. */
export function weeksWithData(weeks: RetailWeek[], minDate: string, maxDate: string): RetailWeek[] {
  return weeks.filter((w) => w.week_end >= minDate && w.week_start <= maxDate);
}

const mmdd = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}`;

/** Year, Period and Week, like the old report's slicers. Changing the year or period jumps to its latest week. */
function RetailWeekPicker({ value, onChange }: { value: FilterState; onChange: (v: FilterState) => void }) {
  const weeks = value.weeks ?? [];
  const current = weeks.find((w) => w.week_start === value.dateFrom) ?? weeks[weeks.length - 1];
  if (!current) return null;
  const pick = (w: RetailWeek | undefined) => w && onChange({ ...value, dateFrom: w.week_start, dateTo: w.week_end });
  const latest = (match: (w: RetailWeek) => boolean) => [...weeks].reverse().find(match);
  const years = [...new Set(weeks.map((w) => w.retail_year))].reverse();
  const periods = [...new Set(weeks.filter((w) => w.retail_year === current.retail_year).map((w) => w.retail_period))];
  const inPeriod = weeks.filter((w) => w.retail_year === current.retail_year && w.retail_period === current.retail_period);
  const field = { size: 'small' as const, select: true, InputLabelProps: { shrink: true } };
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      <TextField {...field} label="Year" value={current.retail_year} sx={{ width: 100 }}
        onChange={(e) => pick(latest((w) => w.retail_year === Number(e.target.value)))}>
        {years.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
      </TextField>
      <TextField {...field} label="Period" value={current.retail_period} sx={{ width: 100 }}
        onChange={(e) => pick(latest((w) => w.retail_year === current.retail_year && w.retail_period === Number(e.target.value)))}>
        {periods.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
      </TextField>
      <TextField {...field} label="Week" value={current.week_start} sx={{ width: { xs: '100%', sm: 250 } }}
        onChange={(e) => pick(weeks.find((w) => w.week_start === e.target.value))}>
        {inPeriod.map((w) => (
          <MenuItem key={w.week_start} value={w.week_start}>Week {w.retail_week}: {mmdd(w.week_start)} – {mmdd(w.week_end)}</MenuItem>
        ))}
      </TextField>
    </Box>
  );
}

type Props = {
  reportId: string;
  spec: Spec;
  value: FilterState;
  onChange: (v: FilterState) => void;
  onReset: () => void;
};

/** All filters in one row above the visuals. An empty dropdown means "All". */
export default function FilterBar({ reportId, spec, value, onChange: change, onReset }: Props) {
  const sound = useSound();
  const onChange = (v: FilterState) => {
    sound.play('filter');
    change(v);
  };
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
            sx={{ width: { xs: '100%', sm: 200 } }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={spec.dimensions[f.dimension].label}
                placeholder={(value.values[f.dimension] ?? []).length ? '' : 'All'}
                InputLabelProps={{ ...params.InputLabelProps, shrink: true }}
              />
            )}
          />
        ) : f.type === 'retail_week' ? (
          <RetailWeekPicker key={f.dimension} value={value} onChange={onChange} />
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
      <Button
        onClick={() => {
          sound.play('whoosh');
          onReset();
        }}
      >
        Reset filters
      </Button>
    </Paper>
  );
}
