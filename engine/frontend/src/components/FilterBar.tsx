import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, ButtonBase, Checkbox, InputBase, MenuItem, Paper, Popover, TextField, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CalendarPopover, { formatRange } from './CalendarPopover';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
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
          height: FIELD_H, minWidth: 120, flex: { xs: '1 1 140px', sm: '0 0 auto' }, px: 1.25, gap: 0.75, justifyContent: 'space-between', borderRadius: '10px', fontSize: '0.84rem',
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


/** The field look shared by the date button and the calendar button (same height and border as the other fields). */
function fieldButtonSx(t: ReturnType<typeof useTokens>, open: boolean) {
  return {
    height: FIELD_H, px: 1.25, gap: 0.75, borderRadius: '10px', fontSize: '0.84rem', color: t.textPrimary, flexShrink: 0,
    bgcolor: t.mode === 'light' ? '#f8fafc' : 'rgba(15,23,42,0.6)',
    border: `1px solid ${open ? t.accent : t.panelBorder}`,
    boxShadow: open ? `0 0 0 3px ${alpha(t.accent, 0.13)}` : 'none',
    transition: 'border-color .2s ease, box-shadow .2s ease',
    '&:hover': { borderColor: alpha(t.accent, 0.6) },
    '&.Mui-focusVisible': { outline: `2px solid ${t.accent}`, outlineOffset: 2 },
  } as const;
}

/** One button with the selected range ("19 May 2026 → 24 Jul 2026"); it opens the calendar. */
function DateRangeFilter({ value, dataDays, onChange }: { value: FilterState; dataDays?: Set<string>; onChange: (v: FilterState) => void }) {
  const t = useTokens();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <ButtonBase
        ref={anchor}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Dates: ${formatRange(value.dateFrom, value.dateTo)}. Change dates`}
        sx={{ ...fieldButtonSx(t, open), justifyContent: 'space-between', maxWidth: '100%' }}
      >
        <CalendarMonthRoundedIcon sx={{ fontSize: 17, color: t.accent }} />
        <Box component="span" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {formatRange(value.dateFrom, value.dateTo)}
        </Box>
        <KeyboardArrowDownRoundedIcon sx={{ fontSize: 18, color: t.textMuted, transition: 'transform .2s ease', transform: open ? 'rotate(180deg)' : 'none' }} />
      </ButtonBase>
      <CalendarPopover
        anchorEl={anchor.current}
        open={open}
        onClose={() => setOpen(false)}
        mode="range"
        from={value.dateFrom}
        to={value.dateTo}
        minDate={value.minDate}
        maxDate={value.maxDate}
        dataDays={dataDays}
        onPick={(from, to) => onChange({ ...value, dateFrom: from, dateTo: to })}
      />
    </>
  );
}

/**
 * One week button, styled like the date-range button ("Week 26 · 21 Jun → 27 Jun 2026"), with ‹ › for the previous
 * and next week. It opens the calendar: a click on any day selects its whole week (Sunday to Saturday), and Year /
 * Period at the top of the calendar jump to the latest week of that year or period, like the old report's slicers.
 */
function RetailWeekPicker({ value, dataDays, onChange }: { value: FilterState; dataDays?: Set<string>; onChange: (v: FilterState) => void }) {
  const t = useTokens();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const weeks = value.weeks ?? [];
  const calendarWeeks = useMemo(
    () => weeks.map((w) => ({ week_start: w.week_start, week_end: w.week_end, label: `${w.retail_year} · P${w.retail_period} · Week ${w.retail_week}` })),
    [weeks],
  );
  const index = weeks.findIndex((w) => w.week_start === value.dateFrom);
  const current = weeks[index] ?? weeks[weeks.length - 1];
  if (!current) return null;
  const at = index < 0 ? weeks.length - 1 : index;
  const pick = (w: RetailWeek | undefined) => w && onChange({ ...value, dateFrom: w.week_start, dateTo: w.week_end });
  const latest = (match: (w: RetailWeek) => boolean) => [...weeks].reverse().find(match);
  const years = [...new Set(weeks.map((w) => w.retail_year))].reverse();
  const periods = [...new Set(weeks.filter((w) => w.retail_year === current.retail_year).map((w) => w.retail_period))];
  const field = { size: 'small' as const, select: true, InputLabelProps: { shrink: true } };
  const arrowSx = { ...fieldButtonSx(t, false), px: 0, width: FIELD_H - 4 };
  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0 }}>
      <Tooltip title="Previous week">
        <span>
          <ButtonBase aria-label="Previous week" disabled={at <= 0} onClick={() => pick(weeks[at - 1])} sx={{ ...arrowSx, opacity: at <= 0 ? 0.4 : 1 }}>
            <ChevronLeftRoundedIcon sx={{ fontSize: 18 }} />
          </ButtonBase>
        </span>
      </Tooltip>
      <ButtonBase
        ref={anchor}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Week ${current.retail_week}, ${formatRange(current.week_start, current.week_end)}. Change week`}
        sx={{ ...fieldButtonSx(t, open), justifyContent: 'space-between', maxWidth: '100%' }}
      >
        <CalendarMonthRoundedIcon sx={{ fontSize: 17, color: t.accent }} />
        <Box component="span" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <Box component="span" sx={{ color: t.textMuted }}>Week {current.retail_week} · </Box>
          {formatRange(current.week_start, current.week_end)}
        </Box>
        <KeyboardArrowDownRoundedIcon sx={{ fontSize: 18, color: t.textMuted, transition: 'transform .2s ease', transform: open ? 'rotate(180deg)' : 'none' }} />
      </ButtonBase>
      <Tooltip title="Next week">
        <span>
          <ButtonBase aria-label="Next week" disabled={at >= weeks.length - 1} onClick={() => pick(weeks[at + 1])} sx={{ ...arrowSx, opacity: at >= weeks.length - 1 ? 0.4 : 1 }}>
            <ChevronRightRoundedIcon sx={{ fontSize: 18 }} />
          </ButtonBase>
        </span>
      </Tooltip>
      <CalendarPopover
        anchorEl={anchor.current}
        open={open}
        onClose={() => setOpen(false)}
        mode="week"
        from={value.dateFrom}
        to={value.dateTo}
        minDate={weeks[0]?.week_start ?? value.minDate}
        maxDate={weeks[weeks.length - 1]?.week_end ?? value.maxDate}
        dataDays={dataDays}
        weeks={calendarWeeks}
        onPick={(from) => pick(weeks.find((w) => w.week_start === from))}
        extra={(
          <>
            <TextField {...field} label="Year" value={current.retail_year} sx={{ ...fieldSx, width: 84 }}
              onChange={(e) => pick(latest((w) => w.retail_year === Number(e.target.value)))}>
              {years.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </TextField>
            <TextField {...field} label="Period" value={current.retail_period} sx={{ ...fieldSx, width: 70 }}
              onChange={(e) => pick(latest((w) => w.retail_year === current.retail_year && w.retail_period === Number(e.target.value)))}>
              {periods.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </TextField>
          </>
        )}
      />
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

/**
 * All filters in one compact row above the visuals: the multi-selects first, then the date or week controls grouped
 * with Reset at the right end. When the row is too narrow, the date group moves down as a whole (Reset stays with it,
 * so it is never left alone on a line). Nothing ticked means "All".
 */
export default function FilterBar({ reportId, spec, value, onChange: change, onReset }: Props) {
  const sound = useSound();
  const onChange = (v: FilterState) => {
    sound.play('filter');
    change(v);
  };
  const [options, setOptions] = useState<Record<string, string[]>>({});
  const [dataDays, setDataDays] = useState<Set<string>>();

  useEffect(() => {
    spec.filters
      .filter((f) => f.type === 'multi_select')
      .forEach((f) =>
        api.values(reportId, f.dimension).then((vals) => setOptions((o) => ({ ...o, [f.dimension]: vals.map(String) }))),
      );
    // The days that have rows, for the dots on the calendar (one cheap distinct-values call; no dots if it fails).
    const dateFilter = spec.filters.find((f) => f.type !== 'multi_select');
    if (dateFilter) {
      api.values(reportId, dateFilter.dimension)
        .then((vals) => setDataDays(new Set(vals.map((v) => String(v).slice(0, 10)))))
        .catch(() => setDataDays(undefined));
    }
  }, [reportId, spec]);

  const multi = spec.filters.filter((f) => f.type === 'multi_select');
  const dates = spec.filters.filter((f) => f.type !== 'multi_select');

  return (
    <Paper sx={{ px: 1.25, py: 1, mb: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
      {multi.map((f) => (
        <MultiSelectFilter
          key={f.dimension}
          label={spec.dimensions[f.dimension].label}
          options={options[f.dimension] ?? []}
          selected={value.values[f.dimension] ?? []}
          onChange={(selected) => onChange({ ...value, values: { ...value.values, [f.dimension]: selected } })}
        />
      ))}
      <Box
        role="group"
        aria-label="Dates"
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', flex: '1 1 auto', minWidth: 0 }}
      >
        {dates.map((f) =>
          f.type === 'retail_week'
            ? <RetailWeekPicker key={f.dimension} value={value} dataDays={dataDays} onChange={onChange} />
            : <DateRangeFilter key={f.dimension} value={value} dataDays={dataDays} onChange={onChange} />,
        )}
        <Button
          size="small"
          startIcon={<RestartAltRoundedIcon sx={{ fontSize: '1rem !important' }} />}
          aria-label="Reset filters"
          sx={{ minWidth: 0, height: FIELD_H, px: 1.25, ml: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }}
          onClick={() => {
            sound.play('whoosh');
            onReset();
          }}
        >
          Reset
        </Button>
      </Box>
    </Paper>
  );
}
