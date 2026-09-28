import { useContext, useEffect, useMemo, useState } from 'react';
import {
  Avatar, Box, Button, ButtonBase, Drawer, IconButton, InputAdornment, TextField, Tooltip, Typography,
} from '@mui/material';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import { api, DataSource, dataMode, isStaticDemo } from './api';
import { SAMPLE_ORANGE, SOURCE_LABEL, sourceColour } from './dataSource';
import { alpha } from '@mui/material/styles';
import { useTokens } from './theme';
import Aurora from './components/Aurora';
import { useSound } from './sound';
import { PrefsContext } from './prefs';
import ReportPage from './ReportPage';
import NotReadyPage from './NotReadyPage';
import { CATALOG, CatalogEntry } from './catalog';
import CustomizePanel from './components/CustomizePanel';

/** Routes: #/r/<id> opens a report. Anything else opens the first report that can show. */
function useHashRoute(): string[] {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  // Old links like #/tender-report still work.
  if (parts.length === 1 && parts[0] !== 'r') return ['r', parts[0]];
  return parts;
}

/** A report that opens shows where its rows come from; the others say why they cannot show. */
type ReportState = DataSource | 'no-data' | 'cannot';
const STATE_LABEL: Record<ReportState, string> = { ...SOURCE_LABEL, 'no-data': 'Could not load', cannot: 'Cannot show yet' };
const isOpen = (s: ReportState): s is DataSource => s === 'live' || s === 'export' || s === 'sample';

/** One report in the menu. 'rail' shows only its number, 'top' is a tab in the top menu. */
function NavItem({ entry, state, active, onPick, variant = 'side' }: {
  entry: CatalogEntry; state: ReportState; active: boolean; onPick: () => void; variant?: 'side' | 'rail' | 'top';
}) {
  const t = useTokens();
  const sound = useSound();
  const dot = isOpen(state) ? sourceColour(state, t) : state === 'no-data' ? SAMPLE_ORANGE : t.textMuted;
  return (
    <Tooltip title={variant === 'side' ? STATE_LABEL[state] : `${entry.title} · ${STATE_LABEL[state]}`} placement={variant === 'top' ? 'bottom' : 'right'}>
      <ButtonBase
        href={`#/r/${entry.id}`}
        onClick={() => { sound.play('click'); onPick(); }}
        sx={{
          width: variant === 'top' ? 'auto' : '100%', flexShrink: 0, justifyContent: variant === 'rail' ? 'center' : 'flex-start',
          gap: 1.25, px: variant === 'rail' ? 0 : 1.25, py: 1, borderRadius: '12px', mb: variant === 'top' ? 0 : 0.5,
          color: active ? t.textPrimary : t.textSecondary, fontWeight: active ? 650 : 500, fontSize: '0.88rem',
          background: active ? `linear-gradient(90deg, ${alpha(t.accent, t.mode === 'light' ? 0.14 : 0.18)}, ${alpha(t.accent2, 0.05)})` : 'transparent',
          boxShadow: active ? `inset 0 0 0 1px ${alpha(t.accent, t.glow ? 0.4 : 0.2)}${t.glow ? `, 0 0 22px -6px ${t.glow}` : ''}` : 'none',
          position: 'relative', overflow: 'hidden', transition: 'background .25s ease, color .25s ease, transform .25s ease',
          opacity: state === 'cannot' && !active ? 0.62 : 1,
          '&:hover': { background: alpha(t.accent, 0.08), color: t.textPrimary, transform: variant === 'side' ? 'translateX(3px)' : 'translateY(-1px)' },
          // A light sweep crosses the active item now and then.
          '&::after': active ? {
            content: '""', position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `linear-gradient(100deg, transparent 30%, ${alpha(t.accent, 0.18)} 50%, transparent 70%)`,
            transform: 'translateX(-100%)', animation: 'sweep 4.5s ease-in-out infinite',
            '@keyframes sweep': { '0%': { transform: 'translateX(-100%)' }, '35%,100%': { transform: 'translateX(100%)' } },
          } : {},
          '&::before': active ? { content: '""', position: 'absolute', ...(variant === 'top' ? { left: 10, right: 10, bottom: 0, height: 3 } : { left: 0, top: 8, bottom: 8, width: 3 }), borderRadius: 3, background: `linear-gradient(${t.accent}, ${t.accent2})`, boxShadow: `0 0 10px ${t.accent}` } : {},
        }}
      >
        <Box
          sx={{
            fontFamily: t.mono, fontSize: '0.7rem', fontWeight: 700, minWidth: 26, height: 22, borderRadius: '7px', display: 'grid', placeItems: 'center',
            color: active ? (t.mode === 'light' ? '#fff' : t.bg) : t.textMuted,
            background: active ? `linear-gradient(135deg, ${t.accent}, ${t.accent2})` : alpha(t.textMuted, 0.12),
            transition: 'background .25s ease',
          }}
        >
          {String(entry.no).padStart(2, '0')}
        </Box>
        {variant !== 'rail' && <Box sx={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.title}</Box>}
        <Box
          aria-label={STATE_LABEL[state]}
          sx={{
            ...(variant === 'rail' ? { position: 'absolute', top: 5, right: 9 } : {}),
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0, bgcolor: dot,
            boxShadow: isOpen(state) ? `0 0 8px ${dot}` : 'none',
            animation: isOpen(state) ? 'blink 2.4s ease-in-out infinite' : 'none',
            '@keyframes blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
          }}
        />
      </ButtonBase>
    </Tooltip>
  );
}

function Clock() {
  const t = useTokens();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <Typography sx={{ fontFamily: t.mono, fontSize: '0.78rem', color: t.textSecondary, display: { xs: 'none', md: 'block' }, fontVariantNumeric: 'tabular-nums' }}>
      {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </Typography>
  );
}

export default function App() {
  const t = useTokens();
  const sound = useSound();
  const { look, setLook } = useContext(PrefsContext);
  const [customize, setCustomize] = useState(false);
  const layout = look.layout;
  const route = useHashRoute();
  const [available, setAvailable] = useState<Map<string, DataSource>>();
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    api.reports()
      .then((list) => setAvailable(new Map(list.map((r) => [r.id, r.dataSource ?? 'live']))))
      .catch(() => setAvailable(new Map()));
  }, []);

  const stateOf = (e: CatalogEntry): ReportState => available?.get(e.id) ?? (e.whyNot ? 'cannot' : 'no-data');
  const mode = available ? dataMode() : undefined;
  // The legend lists the states on screen, so it never shows a colour that is not in the list.
  const legend = useMemo(
    () => (['live', 'export', 'sample', 'no-data', 'cannot'] as ReportState[]).filter((s) => CATALOG.some((e) => stateOf(e) === s)),
    [available],
  );
  const [section, id] = route;
  const current = CATALOG.find((e) => section === 'r' && e.id === id) ?? CATALOG.find((e) => available?.has(e.id)) ?? CATALOG[0];
  const shown = useMemo(
    () => CATALOG.filter((e) => `${e.no} ${e.title} ${e.jira ?? ''}`.toLowerCase().includes(search.trim().toLowerCase())),
    [search],
  );
  const readyCount = available ? CATALOG.filter((e) => available.has(e.id)).length : 0;

  const page = !available
    ? null
    : available.has(current.id)
      ? <ReportPage key={current.id} reportId={current.id} entry={current} source={available.get(current.id)!} />
      : <NotReadyPage key={current.id} entry={current} />;

  const logo = (
        <Box
          aria-hidden
          sx={{
            width: 38, height: 38, borderRadius: '12px', display: 'grid', placeItems: 'center', position: 'relative',
            background: `conic-gradient(from 200deg, ${t.accent}, ${t.accent2}, ${t.series1}, ${t.accent})`,
            boxShadow: t.glow ? `0 0 24px ${t.glow}` : `0 6px 18px -6px ${alpha(t.accent, 0.6)}`,
            animation: 'hue 12s linear infinite', '@keyframes hue': { to: { filter: 'hue-rotate(360deg)' } },
            '&::after': {
              content: '""', position: 'absolute', inset: -4, borderRadius: '15px', border: `1px solid ${alpha(t.accent, 0.5)}`,
              animation: 'ring 2.8s ease-out infinite',
              '@keyframes ring': { from: { opacity: 0.9, transform: 'scale(.9)' }, to: { opacity: 0, transform: 'scale(1.35)' } },
            },
          }}
        >
          <InsightsRoundedIcon sx={{ color: '#fff', fontSize: 21 }} />
        </Box>
  );

  const brand = (
        <Box>
          <Typography sx={{ fontWeight: 800, lineHeight: 1.1, color: t.textPrimary, letterSpacing: '-0.01em' }}>Report Engine</Typography>
        </Box>
  );

  const sidebar = (rail: boolean) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: rail ? 1.25 : 2, pl: rail ? 1.25 : 2.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: rail ? 'center' : 'flex-start', gap: 1.25, px: 0.5, py: 1, mb: 2.5 }}>
        {logo}
        {!rail && brand}
      </Box>

      {!rail && <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', px: 1.25, mb: 1 }}>
        <Typography sx={{ fontSize: '0.66rem', letterSpacing: '0.16em', color: t.textMuted, fontWeight: 700 }}>REPORTS</Typography>
        <Typography sx={{ fontSize: '0.66rem', color: t.textMuted, fontFamily: t.mono }}>{readyCount}/{CATALOG.length} {mode === 'live' ? 'live' : 'open'}</Typography>
      </Box>}
      <Box sx={{ overflowY: 'auto', flex: 1, pr: 0.5 }}>
        {shown.map((e, i) => (
          <Box key={e.id} sx={{ animation: 'navIn .5s cubic-bezier(.2,.8,.2,1) both', animationDelay: `${i * 40}ms`, '@keyframes navIn': { from: { opacity: 0, transform: 'translateX(-10px)' }, to: { opacity: 1, transform: 'none' } } }}>
            <NavItem entry={e} state={stateOf(e)} active={e.id === current.id} onPick={() => setDrawer(false)} variant={rail ? 'rail' : 'side'} />
          </Box>
        ))}
        {shown.length === 0 && <Typography sx={{ px: 1.5, py: 1, fontSize: '0.82rem', color: t.textMuted }}>No report matches “{search}”.</Typography>}
      </Box>

      {!rail && <Box sx={{ p: 1.5, borderRadius: '14px', border: `1px solid ${t.panelBorder}`, background: t.mode === 'light' ? '#f8fafc' : 'rgba(148,163,184,0.05)' }}>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1 }}>
          {legend.map((s) => (
            <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 0.6, fontSize: '0.66rem', color: t.textSecondary }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: isOpen(s) ? sourceColour(s, t) : s === 'no-data' ? SAMPLE_ORANGE : t.textMuted }} />{STATE_LABEL[s]}
            </Box>
          ))}
        </Box>
        <Typography sx={{ fontSize: '0.7rem', color: t.textMuted }}>{mode === 'live' ? 'Connected to' : 'Data from'}</Typography>
        <Typography sx={{ fontSize: '0.74rem', fontFamily: t.mono, color: t.textPrimary }}>
          {mode === 'live' ? 'PostgreSQL DEV · read-only' : mode === 'offline' ? (isStaticDemo ? 'Offline copy · in your browser' : 'No DEV connection · in your browser') : 'Checking the connection…'}
        </Typography>
      </Box>}
    </Box>
  );

  // Top menu: the 10 reports as tabs under the header bar.
  const topMenu = (
    <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5, px: 3, py: 0.75, overflowX: 'auto', borderBottom: `1px solid ${t.panelBorder}`, background: t.headerBar, backdropFilter: 'blur(14px)' }}>
      {shown.map((e) => <NavItem key={e.id} entry={e} state={stateOf(e)} active={e.id === current.id} onPick={() => {}} variant="top" />)}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      <Aurora />
      {layout !== 'top' && (
        <Box
          component="nav"
          aria-label="Reports"
          sx={{
            width: layout === 'rail' ? 76 : 272, flexShrink: 0, position: 'sticky', zIndex: 2, top: 0, height: '100vh', display: { xs: 'none', md: 'block' },
            background: t.sidebar, backdropFilter: t.blur, borderRight: `1px solid ${t.panelBorder}`, transition: 'background .4s ease, width .3s ease',
          }}
        >
          {sidebar(layout === 'rail')}
        </Box>
      )}
      <Drawer open={drawer} onClose={() => setDrawer(false)} PaperProps={{ sx: { width: 280, background: t.panelSolid, borderRadius: 0 } }}>
        {sidebar(false)}
      </Drawer>
      <CustomizePanel open={customize} onClose={() => setCustomize(false)} />

      <Box sx={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
        <Box
          component="header"
          sx={{
            position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 2, md: 3 }, py: 1.5,
            background: t.headerBar, backdropFilter: 'blur(14px) saturate(140%)', borderBottom: `1px solid ${t.panelBorder}`,
            '&::after': {
              content: '""', position: 'absolute', left: 0, right: 0, bottom: -1, height: '1px',
              background: `linear-gradient(90deg, transparent, ${t.accent}, ${t.accent2}, transparent)`, backgroundSize: '200% 100%',
              animation: 'line 6s linear infinite', '@keyframes line': { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
              opacity: 0.7,
            },
          }}
        >
          <IconButton aria-label="Open the report list" onClick={() => setDrawer(true)} sx={{ display: { md: 'none' } }}><MenuRoundedIcon /></IconButton>
          {layout === 'top' && <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1.25, mr: 1 }}>{logo}{brand}</Box>}
          <TextField
            size="small"
            placeholder="Find a report…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: { sm: 240, md: 300 }, display: { xs: 'none', sm: 'inline-flex' } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }}
          />
          <Box sx={{ flex: 1 }} />
          <Clock />
          <Tooltip title={t.mode === 'light' ? 'Switch to dark' : 'Switch to light'}>
            <IconButton
              aria-label={t.mode === 'light' ? 'Switch to dark' : 'Switch to light'}
              onClick={() => { setLook({ theme: t.mode === 'light' ? 'neon' : 'light' }); sound.play('whoosh'); }}
            >
              {t.mode === 'light' ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon />}
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            variant="outlined"
            startIcon={<PaletteRoundedIcon />}
            onClick={() => { setCustomize(true); sound.play('click'); }}
            sx={{ borderColor: t.panelBorder, color: t.textPrimary, '&:hover': { borderColor: t.accent, background: alpha(t.accent, 0.08) } }}
          >
            Customize
          </Button>
          <Tooltip title={sound.enabled ? 'Sound on' : 'Sound off'}>
            <IconButton aria-label={sound.enabled ? 'Turn sound off' : 'Turn sound on'} onClick={() => sound.setEnabled(!sound.enabled)}>
              {sound.enabled ? <VolumeUpRoundedIcon /> : <VolumeOffRoundedIcon />}
            </IconButton>
          </Tooltip>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1 }}>
            <Avatar sx={{ width: 34, height: 34, fontSize: '0.85rem', fontWeight: 700, background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})`, color: t.mode === 'light' ? '#fff' : t.bg }}>AG</Avatar>
            <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 650, lineHeight: 1.1, color: t.textPrimary }}>Abinithi</Typography>
              <Typography sx={{ fontSize: '0.72rem', color: t.textMuted }}>Full stack developer</Typography>
            </Box>
          </Box>
        </Box>
        {layout === 'top' && topMenu}
        <Box
          key={current.id}
          sx={{ animation: 'pageIn .55s cubic-bezier(.2,.8,.2,1) both', '@keyframes pageIn': { from: { opacity: 0, transform: 'translateY(10px)', filter: 'blur(4px)' }, to: { opacity: 1, transform: 'none', filter: 'none' } } }}
        >
          {page}
        </Box>
      </Box>
    </Box>
  );
}
