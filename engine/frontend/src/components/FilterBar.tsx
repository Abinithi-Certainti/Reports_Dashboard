import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, ButtonBase, Checkbox, InputBase, MenuItem, Paper, Popover, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import { api, RetailWeek, Spec } from '../api';
import { useSound } from '../sound';
import { useTokens } from '../theme';

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

/** Every field in the bar is this tall, so buttons, dates and dropdowns line up in one compact row. */
const FIELD_H = 34;
const fieldSx = {
  '& .MuiInputBase-root': { height: FIELD_H, fontSize: '0.84rem', borderRadius: '10px' },
  '& .MuiInputLabel-root': { fontSize: '0.8rem' },
} as const;

/**
 * A multi-select filter as a small button ("Plaza: All", or "Plaza" + a count). Clicking it opens a list with a search box,
 * "Select all" / "Clear" and a checkbox per value. Every tick applies at once. Nothing ticked means All.
 */
function MultiSelectFilter({ label, options, selected, onChange }: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const t = useTokens();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const chosen = useMemo(() => new Set(selected), [selected]);
  const shown = options.filter((o) => o.toLowerCase().includes(search.trim().toLowerCase()));
  const on = selected.length > 0;
  const flip = (v: string) => onChange(chosen.has(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const link = { fontSize: '0.78rem', fontWeight: 600, color: t.accent, px: 0.25, borderRadius: '4px', '&:hover': { textDecoration: 'underline' } } as const;
  return (
    <>
      <ButtonBase
        ref={anchor}
        onClick={() => { setSearch(''); setOpen(true); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${on ? `${selected.length} selected` : 'All'}`}
        sx={{
          height: FIELD_H, minWidth: 120, px: 1.25, gap: 0.75, justifyContent: 'space-between', borderRadius: '10px', fontSize: '0.84rem',
          color: t.textPrimary, bgcolor: t.mode === 'light' ? '#f8fafc' : 'rgba(15,23,42,0.6)',
          border: `1px solid ${on || open ? t.accent : t.panelBorder}`,
          boxShadow: on || open ? `0 0 0 3px ${alpha(t.accent, 0.13)}` : 'none',
          transition: 'border-color .2s ease, box-shadow .2s ease',
          '&:hover': { borderColor: alpha(t.accent, 0.6) },
          '&.Mui-focusVisible': { outline: `2px solid ${t.accent}`, outlineOffset: 2 },
        }}
      >
        <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
          <Box component="span" sx={{ color: t.textMuted }}>{label}{on ? '' : ':'}</Box>{on ? '' : ' All'}
        </Box>
        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {on && (
            <Box component="span" sx={{ bgcolor: t.accent, color: t.mode === 'light' ? '#fff' : t.bg, borderRadius: '6px', px: 0.75, fontSize: '0.72rem', fontWeight: 700, lineHeight: '18px' }}>
              {selected.length}
            </Box>
          )}
          <KeyboardArrowDownRoundedIcon sx={{ fontSize: 18, color: t.textMuted, transition: 'transform .2s ease', transform: open ? 'rotate(180deg)' : 'none' }} />
        </Box>
      </ButtonBase>
      <Popover
        open={open}
        anchorEl={anchor.current}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.75, width: 260, p: 1, bgcolor: t.panelSolid, backgroundImage: 'none', backdropFilter: 'none', borderRadius: '12px',
              boxShadow: t.mode === 'light' ? '0 20px 40px -12px rgba(15,23,42,0.25)' : '0 20px 40px -12px rgba(0,0,0,0.8)',
              '&:hover': { borderColor: t.panelBorder },
            },
          },
        }}
      >
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.75, px: 1, height: 32, borderRadius: '8px',
            border: `1px solid ${t.panelBorder}`, bgcolor: t.mode === 'light' ? '#f8fafc' : 'rgba(15,23,42,0.8)',
            '&:focus-within': { borderColor: t.accent },
          }}
        >
          <SearchRoundedIcon sx={{ fontSize: 16, color: t.textMuted }} />
          <InputBase
            autoFocus
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            inputProps={{ 'aria-label': `Search ${label}` }}
            sx={{ fontSize: '0.84rem', color: t.textPrimary }}
          />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 0.5, py: 0.75 }}>
          <ButtonBase sx={link} onClick={() => onChange([...new Set([...selected, ...shown])])}>Select all</ButtonBase>
          <ButtonBase sx={link} onClick={() => onChange(search ? selected.filter((v) => !shown.includes(v)) : [])}>Clear</ButtonBase>
        </Box>
        <Box role="listbox" aria-multiselectable aria-label={label} sx={{ maxHeight: 240, overflowY: 'auto' }}>
          {shown.map((v) => (
            <Box
              key={v}
              component="label"
              role="option"
              aria-selected={chosen.has(v)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.5, pr: 1, borderRadius: '7px', cursor: 'pointer', fontSize: '0.84rem', color: t.textPrimary,
                '&:hover': { bgcolor: alpha(t.accent, 0.08) },
              }}
            >
              <Checkbox size="small" checked={chosen.has(v)} onChange={() => flip(v)} sx={{ p: 0.5, color: t.textMuted, '&.Mui-checked': { color: t.accent } }} />
              <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</Box>
            </Box>
          ))}
          {shown.length === 0 && (
            <Typography sx={{ fontSize: '0.8rem', color: t.textMuted, px: 1, py: 1 }}>{options.length ? 'No match' : 'Loading…'}</Typography>
          )}
        </Box>
      </Popover>
    </>
  );
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
  const field = { size: 'small' as const, select: true, InputLabelProps: { shrink: true }, sx: fieldSx };
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      <TextField {...field} label="Year" value={current.retail_year} sx={{ ...fieldSx, width: 92 }}
        onChange={(e) => pick(latest((w) => w.retail_year === Number(e.target.value)))}>
        {years.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
      </TextField>
      <TextField {...field} label="Period" value={current.retail_period} sx={{ ...fieldSx, width: 84 }}
        onChange={(e) => pick(latest((w) => w.retail_year === current.retail_year && w.retail_period === Number(e.target.value)))}>
        {periods.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
      </TextField>
      <TextField {...field} label="Week" value={current.week_start} sx={{ ...fieldSx, width: { xs: '100%', sm: 200 } }}
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

/** All filters in one compact row above the visuals (it wraps on narrow screens). Nothing ticked means "All". */
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
    <Paper sx={{ px: 1.25, py: 1, mb: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
      {spec.filters.map((f) =>
        f.type === 'multi_select' ? (
          <MultiSelectFilter
            key={f.dimension}
            label={spec.dimensions[f.dimension].label}
            options={options[f.dimension] ?? []}
            selected={value.values[f.dimension] ?? []}
            onChange={(selected) => onChange({ ...value, values: { ...value.values, [f.dimension]: selected } })}
          />
        ) : f.type === 'retail_week' ? (
          <RetailWeekPicker key={f.dimension} value={value} onChange={onChange} />
        ) : (
          <Box key={f.dimension} sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              type="date"
              label="From"
              sx={{ ...fieldSx, width: 150 }}
              value={value.dateFrom}
              inputProps={{ min: value.minDate, max: value.dateTo }}
              onChange={(e) => e.target.value && onChange({ ...value, dateFrom: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              size="small"
              type="date"
              label="To"
              sx={{ ...fieldSx, width: 150 }}
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
        size="small"
        startIcon={<RestartAltRoundedIcon sx={{ fontSize: '1rem !important' }} />}
        aria-label="Reset filters"
        sx={{ minWidth: 0, px: 1, whiteSpace: 'nowrap' }}
        onClick={() => {
          sound.play('whoosh');
          onReset();
        }}
      >
        Reset
      </Button>
    </Paper>
  );
}
