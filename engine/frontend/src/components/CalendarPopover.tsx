import { useEffect, useMemo, useState } from 'react';
import { Box, ButtonBase, IconButton, Popover, Typography, useMediaQuery } from '@mui/material';
import { alpha, Theme } from '@mui/material/styles';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { addDays } from '../format';
import { useSound } from '../sound';
import { useTokens } from '../theme';

// Days are plain "YYYY-MM-DD" strings everywhere (no time zone shift); they compare as text.

/** A week the calendar can select as one block (Sunday to Saturday). */
export type CalendarWeek = { week_start: string; week_end: string; label?: string };

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const weekday = (iso: string) => utc(iso).getUTCDay(); // 0 = Sunday
const monthOf = (iso: string) => `${iso.slice(0, 7)}-01`;
function addMonths(first: string, n: number): string {
  const d = utc(first);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)).toISOString().slice(0, 10);
}
const daysInMonth = (first: string) => { const d = utc(first); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); };
const monthTitle = (first: string) => utc(first).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const longDay = (iso: string) => utc(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
/** "19 May 2026" */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const formatShortDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
/** "19 May 2026 → 24 Jul 2026" (one date when both ends are the same day). */
export const formatRange = (from: string, to: string) => (from === to ? formatShortDate(from) : `${formatShortDate(from)} → ${formatShortDate(to)}`);
const dayCount = (from: string, to: string) => Math.round((utc(to).getTime() - utc(from).getTime()) / 86_400_000) + 1;
function todayIso() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

type Preset = { label: string; from: string; to: string };

/** Quick ranges, all counted back from the latest day that has data (never from a fixed date or from today). */
function rangePresets(minDate: string, maxDate: string): Preset[] {
  const clamp = (d: string) => (d < minDate ? minDate : d);
  return [
    { label: 'All available days', from: minDate, to: maxDate },
    { label: 'Last 7 days', from: clamp(addDays(maxDate, -6)), to: maxDate },
    { label: 'Last 30 days', from: clamp(addDays(maxDate, -29)), to: maxDate },
    { label: 'This month', from: clamp(monthOf(maxDate)), to: maxDate },
  ];
}

function weekPresets(weeks: CalendarWeek[]): Preset[] {
  const out: Preset[] = [];
  const last = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  if (last) out.push({ label: 'Latest week', from: last.week_start, to: last.week_end });
  if (prev) out.push({ label: 'Previous week', from: prev.week_start, to: prev.week_end });
  return out;
}

type Props = {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  /** 'range': click a first and a last day. 'week': a click selects the whole week (from `weeks`) around that day. */
  mode: 'range' | 'week';
  from: string;
  to: string;
  minDate: string;
  maxDate: string;
  /** Days that have rows get a small dot. */
  dataDays?: Set<string>;
  weeks?: CalendarWeek[];
  onPick: (from: string, to: string) => void;
};

/**
 * A popover calendar: two months side by side (one on phones), quick presets, the selected range highlighted, today
 * ringed, days outside the data greyed out and days with data dotted. A range applies on the second click. Esc or a
 * click outside closes it.
 */
export default function CalendarPopover({ anchorEl, open, onClose, mode, from, to, minDate, maxDate, dataDays, weeks = [], onPick }: Props) {
  const t = useTokens();
  const sound = useSound();
  const phone = useMediaQuery((th: Theme) => th.breakpoints.down('sm'));
  const months = phone ? 1 : 2;
  const minMonth = monthOf(minDate);
  const maxMonth = monthOf(maxDate);
  const today = todayIso();

  // The first month shown: the month of the selected end, with the month before it on its left (kept inside the data).
  const startView = () => {
    let first = addMonths(monthOf(to), -(months - 1));
    if (first < minMonth) first = minMonth;
    return first;
  };
  const [view, setView] = useState(startView);
  const [pending, setPending] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setView(startView());
      setPending(null);
      setHover(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, months]);

  const weekOf = useMemo(() => {
    const sorted = [...weeks].sort((a, b) => (a.week_start < b.week_start ? -1 : 1));
    return (day: string) => sorted.find((w) => w.week_start <= day && day <= w.week_end);
  }, [weeks]);

  const enabled = (day: string) => (mode === 'week' ? !!weekOf(day) : day >= minDate && day <= maxDate);

  // What is highlighted right now: the pick in progress (with the day under the pointer), else the current selection.
  let lo = from;
  let hi = to;
  if (mode === 'range' && pending) {
    const other = hover ?? pending;
    [lo, hi] = pending <= other ? [pending, other] : [other, pending];
  } else if (mode === 'week' && hover) {
    const w = weekOf(hover);
    if (w) [lo, hi] = [w.week_start, w.week_end];
  }
  const previewing = (mode === 'range' && !!pending) || (mode === 'week' && !!hover && !!weekOf(hover));

  const click = (day: string) => {
    if (!enabled(day)) return;
    sound.play('click');
    if (mode === 'week') {
      const w = weekOf(day);
      if (!w) return;
      onPick(w.week_start, w.week_end);
      onClose();
      return;
    }
    if (!pending) {
      setPending(day);
      return;
    }
    const [a, b] = pending <= day ? [pending, day] : [day, pending];
    setPending(null);
    onPick(a, b);
    onClose();
  };

  const presets = mode === 'week' ? weekPresets(weeks) : rangePresets(minDate, maxDate);
  const applyPreset = (p: Preset) => {
    sound.play('click');
    setPending(null);
    onPick(p.from, p.to);
    onClose();
  };

  const onAccent = t.mode === 'light' ? '#fff' : t.bg;
  const band = alpha(t.accent, t.mode === 'light' ? 0.13 : 0.2);
  const cell = phone ? 40 : 36;

  const renderMonth = (first: string) => {
    const lead = weekday(first);
    const count = daysInMonth(first);
    const slots: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => addDays(first, i))];
    while (slots.length < 42) slots.push(null); // always six rows, so the popover never jumps in height
    return (
      <Box key={first} sx={{ width: cell * 7 }}>
        <Typography sx={{ textAlign: 'center', fontWeight: 650, fontSize: '0.88rem', color: t.textPrimary, height: 30, lineHeight: '30px' }}>
          {monthTitle(first)}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(7, ${cell}px)` }}>
          {WEEKDAYS.map((d) => (
            <Box key={d} sx={{ textAlign: 'center', fontSize: '0.68rem', fontWeight: 650, letterSpacing: '0.04em', color: t.textMuted, height: 24, lineHeight: '24px' }}>{d}</Box>
          ))}
          {slots.map((day, i) => {
            if (!day) return <Box key={`e${i}`} sx={{ height: cell - 2 }} />;
            const on = enabled(day);
            const inRange = day >= lo && day <= hi;
            const isStart = day === lo;
            const isEnd = day === hi;
            const end = mode === 'range' ? (isStart || isEnd) : false;
            const wd = weekday(day);
            const lastOfMonth = Number(day.slice(8)) === count;
            const firstOfMonth = day.slice(8) === '01';
            const roundL = isStart || wd === 0 || firstOfMonth;
            const roundR = isEnd || wd === 6 || lastOfMonth;
            const hasData = dataDays?.has(day);
            const isToday = day === today;
            const selectedWeek = mode === 'week' && inRange;
            return (
              <Box
                key={day}
                sx={{
                  height: cell - 2, my: '1px', display: 'grid', placeItems: 'center',
                  bgcolor: inRange ? (previewing ? alpha(t.accent, t.mode === 'light' ? 0.09 : 0.13) : band) : 'transparent',
                  borderTopLeftRadius: inRange && roundL ? 10 : 0, borderBottomLeftRadius: inRange && roundL ? 10 : 0,
                  borderTopRightRadius: inRange && roundR ? 10 : 0, borderBottomRightRadius: inRange && roundR ? 10 : 0,
                  transition: 'background-color .15s ease',
                }}
              >
                <ButtonBase
                  disabled={!on}
                  onClick={() => click(day)}
                  onMouseEnter={() => setHover(day)}
                  onFocus={() => setHover(day)}
                  aria-label={`${longDay(day)}${isToday ? ', today' : ''}${hasData ? ', has data' : ''}`}
                  aria-pressed={inRange}
                  sx={{
                    width: cell - 6, height: cell - 6, borderRadius: '9px', position: 'relative', fontSize: '0.8rem', fontFamily: t.mono,
                    fontWeight: end || isToday ? 700 : selectedWeek ? 600 : 500,
                    color: !on ? alpha(t.textMuted, 0.5) : end ? onAccent : inRange ? t.textPrimary : t.textSecondary,
                    background: end ? `linear-gradient(135deg, ${t.accent}, ${t.accent2})` : 'transparent',
                    boxShadow: end
                      ? `0 4px 14px -4px ${alpha(t.accent, 0.7)}${t.glow ? `, 0 0 14px -2px ${t.glow}` : ''}`
                      : isToday ? `inset 0 0 0 1.5px ${alpha(t.accent2, 0.85)}` : 'none',
                    textDecoration: !on ? 'line-through' : 'none', textDecorationColor: alpha(t.textMuted, 0.35),
                    transition: 'background .15s ease, color .15s ease, transform .15s ease',
                    '&:hover': on && !end ? { bgcolor: alpha(t.accent, 0.16), color: t.textPrimary, transform: 'scale(1.06)' } : {},
                    '&.Mui-focusVisible': { outline: `2px solid ${t.accent}`, outlineOffset: 1 },
                    '&.Mui-disabled': { color: alpha(t.textMuted, 0.45) },
                  }}
                >
                  {Number(day.slice(8))}
                  {hasData && (
                    <Box
                      component="span"
                      aria-hidden
                      sx={{
                        position: 'absolute', bottom: 3, left: '50%', width: 4, height: 4, ml: '-2px', borderRadius: '50%',
                        bgcolor: end ? onAccent : on ? t.accent : alpha(t.textMuted, 0.5), opacity: end ? 0.9 : 0.85,
                      }}
                    />
                  )}
                </ButtonBase>
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  };

  const shown = Array.from({ length: months }, (_, i) => addMonths(view, i));
  const canPrev = view > minMonth;
  const canNext = shown[shown.length - 1] < maxMonth;
  const step = (n: number) => { sound.play('click'); setView((v) => addMonths(v, n)); };

  const hint = mode === 'week'
    ? (hover && weekOf(hover) ? `${weekOf(hover)!.label ?? 'Week'} · ${formatRange(weekOf(hover)!.week_start, weekOf(hover)!.week_end)}` : 'Click any day to pick its week (Sunday to Saturday)')
    : pending
      ? `From ${formatShortDate(pending)} - now click the last day`
      : `${formatRange(from, to)} · ${dayCount(from, to)} day${dayCount(from, to) === 1 ? '' : 's'}`;

  const presetActive = (p: Preset) => !pending && p.from === from && p.to === to;
  const presetList = (
    <Box
      sx={{
        display: 'flex', flexDirection: phone ? 'row' : 'column', flexWrap: phone ? 'wrap' : 'nowrap', gap: 0.5,
        pr: phone ? 0 : 1.25, mr: phone ? 0 : 1.25, mb: phone ? 1 : 0, borderRight: phone ? 'none' : `1px solid ${t.panelBorder}`, minWidth: phone ? 0 : 150,
      }}
    >
      {!phone && <Typography sx={{ fontSize: '0.66rem', letterSpacing: '0.14em', fontWeight: 700, color: t.textMuted, px: 1, pt: 0.5, pb: 0.5 }}>QUICK PICK</Typography>}
      {presets.map((p) => (
        <ButtonBase
          key={p.label}
          onClick={() => applyPreset(p)}
          sx={{
            justifyContent: 'flex-start', px: 1, py: phone ? 0.5 : 0.75, borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap',
            color: presetActive(p) ? t.accent : t.textSecondary,
            bgcolor: presetActive(p) ? alpha(t.accent, 0.12) : phone ? alpha(t.textMuted, 0.1) : 'transparent',
            boxShadow: presetActive(p) ? `inset 0 0 0 1px ${alpha(t.accent, 0.35)}` : 'none',
            transition: 'background .15s ease, color .15s ease',
            '&:hover': { bgcolor: alpha(t.accent, 0.1), color: t.textPrimary },
            '&.Mui-focusVisible': { outline: `2px solid ${t.accent}` },
          }}
        >
          {p.label}
        </ButtonBase>
      ))}
    </Box>
  );

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={() => { setPending(null); onClose(); }}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      marginThreshold={8}
      slotProps={{
        paper: {
          'aria-label': mode === 'week' ? 'Pick a retail week' : 'Pick a date range',
          sx: {
            mt: 0.75, p: 1.25, maxWidth: 'calc(100vw - 16px)', bgcolor: t.panelSolid, backgroundImage: 'none', backdropFilter: 'none', borderRadius: '14px',
            boxShadow: t.mode === 'light' ? '0 24px 48px -16px rgba(15,23,42,0.28)' : '0 24px 48px -16px rgba(0,0,0,0.85)',
            '&:hover': { borderColor: t.panelBorder },
          },
        } as object,
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: phone ? 'column' : 'row' }} onMouseLeave={() => setHover(null)}>
        {presets.length > 0 && presetList}
        <Box>
          <Box sx={{ position: 'relative', display: 'flex', gap: 2 }}>
            <IconButton size="small" aria-label="Previous month" disabled={!canPrev} onClick={() => step(-1)} sx={{ position: 'absolute', left: 0, top: 0, p: 0.5, zIndex: 1 }}>
              <ChevronLeftRoundedIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" aria-label="Next month" disabled={!canNext} onClick={() => step(1)} sx={{ position: 'absolute', right: 0, top: 0, p: 0.5, zIndex: 1 }}>
              <ChevronRightRoundedIcon fontSize="small" />
            </IconButton>
            {shown.map(renderMonth)}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1, pt: 1, borderTop: `1px solid ${t.panelBorder}`, flexWrap: 'wrap' }}>
            <Typography aria-live="polite" sx={{ fontSize: '0.78rem', color: pending ? t.accent : t.textSecondary, fontWeight: pending ? 600 : 500, flex: '1 1 auto', minWidth: 0 }}>
              {hint}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontSize: '0.68rem', color: t.textMuted }}>
              {dataDays && dataDays.size > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: t.accent }} />has data
                </Box>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 11, height: 11, borderRadius: '4px', boxShadow: `inset 0 0 0 1.5px ${alpha(t.accent2, 0.85)}` }} />today
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Popover>
  );
}
