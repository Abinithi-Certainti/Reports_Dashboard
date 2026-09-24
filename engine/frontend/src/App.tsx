import { useCallback, useContext, useEffect, useState } from 'react';
import {
  Avatar, Box, ButtonBase, Chip, IconButton, InputAdornment, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { api, isStaticDemo, ReportSummary } from './api';
import { alpha } from '@mui/material/styles';
import { ThemeName, useTokens } from './theme';
import Aurora from './components/Aurora';
import { useSound } from './sound';
import { PrefsContext } from './prefs';
import ReportPage from './ReportPage';
import HomePage from './pages/HomePage';
import MappingStudio from './pages/MappingStudio';
import ImportPage from './pages/ImportPage';

/** Routes: #/ home, #/r/<id> report, #/mapping[/<id>] mapping studio, #/import import. */
function useHashRoute(): string[] {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  // Old links like #/tender-report still work.
  if (parts.length === 1 && !['mapping', 'import', 'r'].includes(parts[0])) return ['r', parts[0]];
  return parts;
}

function NavItem({ href, icon, label, active, badge }: { href: string; icon: JSX.Element; label: string; active: boolean; badge?: string }) {
  const t = useTokens();
  const sound = useSound();
  return (
    <ButtonBase
      href={href}
      onClick={() => sound.play('click')}
      sx={{
        width: '100%', justifyContent: 'flex-start', gap: 1.5, px: 1.5, py: 1.1, borderRadius: '12px', mb: 0.5,
        color: active ? t.textPrimary : t.textSecondary, fontWeight: active ? 650 : 500, fontSize: '0.92rem',
        background: active ? `linear-gradient(90deg, ${alpha(t.accent, t.mode === 'light' ? 0.12 : 0.16)}, ${alpha(t.accent2, 0.06)})` : 'transparent',
        boxShadow: active ? `inset 0 0 0 1px ${alpha(t.accent, t.glow ? 0.35 : 0.18)}${t.glow ? `, 0 0 18px -6px ${t.glow}` : ''}` : 'none',
        position: 'relative', transition: 'background .2s ease, color .2s ease',
        '&:hover': { background: alpha(t.accent, 0.07), color: t.textPrimary, '& .nav-icon': { transform: 'scale(1.12)' } },
        '&::before': active ? { content: '""', position: 'absolute', left: -12, top: 10, bottom: 10, width: 3, borderRadius: 3, background: t.accent } : {},
      }}
    >
      <Box className="nav-icon" sx={{ display: 'grid', placeItems: 'center', color: active ? t.accent : 'inherit', transition: 'transform .2s ease' }}>{icon}</Box>
      <Box sx={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</Box>
      {badge && <Chip size="small" label={badge} sx={{ height: 20, fontSize: '0.68rem', bgcolor: `${t.accent}22`, color: t.accent }} />}
    </ButtonBase>
  );
}

export default function App() {
  const t = useTokens();
  const sound = useSound();
  const { themeName, setThemeName } = useContext(PrefsContext);
  const route = useHashRoute();
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [search, setSearch] = useState('');

  const refresh = useCallback(() => {
    api.reports().then(setReports).catch(() => setReports([]));
  }, []);
  useEffect(refresh, [refresh]);

  const [section, id] = route;
  const page =
    section === 'r' && id ? <ReportPage key={id} reportId={id} />
      : section === 'mapping' ? <MappingStudio reportId={id ?? 'tender-report'} reports={reports} />
        : section === 'import' ? <ImportPage onPublished={refresh} />
          : <HomePage reports={reports} search={search} />;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      <Aurora />
      {/* ---------------- sidebar ---------------- */}
      <Box
        component="nav"
        sx={{
          width: 248, flexShrink: 0, position: 'sticky', zIndex: 2, top: 0, height: '100vh', p: 2, pl: 2.5, display: { xs: 'none', md: 'flex' },
          flexDirection: 'column', background: t.sidebar, backdropFilter: t.blur, borderRight: `1px solid ${t.panelBorder}`,
          transition: 'background .4s ease',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 0.5, py: 1, mb: 2 }}>
          <Box
            aria-hidden
            sx={{
              width: 34, height: 34, borderRadius: '11px', display: 'grid', placeItems: 'center',
              background: `conic-gradient(from 200deg, ${t.accent}, ${t.accent2}, ${t.series1}, ${t.accent})`,
              boxShadow: t.glow ? `0 0 20px ${t.glow}` : 'none',
              animation: 'spin 12s linear infinite', '@keyframes spin': { to: { filter: 'hue-rotate(360deg)' } },
            }}
          >
            <InsightsRoundedIcon sx={{ color: '#fff', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 750, lineHeight: 1.1, color: t.textPrimary }}>Report Engine</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: t.textMuted }}>{isStaticDemo ? 'Online demo · sample data' : 'Certainti · Reports 2.0'}</Typography>
          </Box>
        </Box>

        <Typography sx={{ fontSize: '0.68rem', letterSpacing: '0.14em', color: t.textMuted, fontWeight: 650, px: 1.5, mb: 1 }}>MAIN MENU</Typography>
        <NavItem href="#/" icon={<DashboardRoundedIcon fontSize="small" />} label="Overview" active={!section} />
        <NavItem href="#/mapping" icon={<AccountTreeRoundedIcon fontSize="small" />} label="Mapping Studio" active={section === 'mapping'} />
        <NavItem href="#/import" icon={<CloudUploadRoundedIcon fontSize="small" />} label="Import report" active={section === 'import'} />

        <Typography sx={{ fontSize: '0.68rem', letterSpacing: '0.14em', color: t.textMuted, fontWeight: 650, px: 1.5, mt: 2.5, mb: 1 }}>
          REPORTS · {reports.length}
        </Typography>
        <Box sx={{ overflowY: 'auto', flex: 1, pr: 0.5 }}>
          {reports.map((r) => (
            <NavItem
              key={r.id}
              href={`#/r/${r.id}`}
              icon={<InsightsRoundedIcon fontSize="small" />}
              label={r.title}
              active={section === 'r' && id === r.id}
              badge={r.imported ? 'new' : undefined}
            />
          ))}
        </Box>

        <Box sx={{ ...{ p: 1.5, borderRadius: '14px', border: `1px solid ${t.panelBorder}`, background: t.mode === 'light' ? '#f8fafc' : 'rgba(148,163,184,0.05)' } }}>
          <Typography sx={{ fontSize: '0.72rem', color: t.textMuted }}>{isStaticDemo ? 'Runs in' : 'Connected to'}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: t.good, boxShadow: `0 0 8px ${t.good}` }} />
            <Typography sx={{ fontSize: '0.74rem', fontFamily: t.mono, color: t.textPrimary, whiteSpace: 'nowrap' }}>{isStaticDemo ? 'your browser · no server' : 'PostgreSQL · read-only'}</Typography>
          </Box>
        </Box>
      </Box>

      {/* ---------------- main ---------------- */}
      <Box sx={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
        <Box
          component="header"
          sx={{
            position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 2, md: 3 }, py: 1.5,
            background: t.headerBar, backdropFilter: 'blur(14px) saturate(140%)',
            borderBottom: `1px solid ${t.panelBorder}`,
          }}
        >
          <TextField
            size="small"
            placeholder="Search reports…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (section) window.location.hash = '#/';
            }}
            sx={{ width: { xs: 180, sm: 320 } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }}
          />
          <Box sx={{ flex: 1 }} />
          <ToggleButtonGroup
            size="small"
            exclusive
            value={themeName}
            onChange={(_, v: ThemeName | null) => {
              if (v) {
                setThemeName(v);
                sound.play('whoosh');
              }
            }}
            aria-label="Theme"
          >
            <ToggleButton value="light" aria-label="Light theme"><Tooltip title="Light"><LightModeRoundedIcon fontSize="small" /></Tooltip></ToggleButton>
            <ToggleButton value="midnight" aria-label="Midnight theme"><Tooltip title="Midnight"><DarkModeRoundedIcon fontSize="small" /></Tooltip></ToggleButton>
            <ToggleButton value="neon" aria-label="Neon theme"><Tooltip title="Neon"><AutoAwesomeRoundedIcon fontSize="small" /></Tooltip></ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title={sound.enabled ? 'Sound on' : 'Sound off'}>
            <IconButton aria-label={sound.enabled ? 'Turn sound off' : 'Turn sound on'} onClick={() => sound.setEnabled(!sound.enabled)}>
              {sound.enabled ? <VolumeUpRoundedIcon /> : <VolumeOffRoundedIcon />}
            </IconButton>
          </Tooltip>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1 }}>
            <Avatar sx={{ width: 34, height: 34, fontSize: '0.85rem', fontWeight: 700, bgcolor: t.accent, color: t.mode === 'light' ? '#fff' : t.bg }}>AG</Avatar>
            <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 650, lineHeight: 1.1, color: t.textPrimary }}>Abinithi</Typography>
              <Typography sx={{ fontSize: '0.72rem', color: t.textMuted }}>Full stack developer</Typography>
            </Box>
          </Box>
        </Box>
        <Box key={route.join('/')} sx={{ animation: 'pageIn .45s ease both', '@keyframes pageIn': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } } }}>
          {page}
        </Box>
      </Box>
    </Box>
  );
}
