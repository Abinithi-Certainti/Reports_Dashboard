import { alpha, createTheme } from '@mui/material/styles';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';

// "Deep space" look: near-black surface, glass panels, one cool accent. Chart marks use the accent;
// text always uses text colours, never the chart colour.
export const tokens = {
  bg: '#070b14',
  panel: 'rgba(17, 24, 39, 0.62)',
  panelBorder: 'rgba(148, 163, 184, 0.14)',
  panelBorderHover: 'rgba(56, 189, 248, 0.45)',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  accent: '#38bdf8',      // cyan
  accentDeep: '#3987e5',  // blue (data-viz series 1, dark step)
  accent2: '#a78bfa',     // violet, only for glows and the brand mark
  grid: 'rgba(148, 163, 184, 0.10)',
  mono: '"JetBrains Mono Variable", ui-monospace, monospace',
};

export const chartColors = {
  series1: tokens.accentDeep,
  series1Light: tokens.accent,
  grid: tokens.grid,
  axisText: tokens.textSecondary,
  surface: tokens.bg,
};

export const glass = {
  background: tokens.panel,
  backdropFilter: 'blur(14px) saturate(140%)',
  border: `1px solid ${tokens.panelBorder}`,
  borderRadius: '18px',
  boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 40px -24px rgba(0,0,0,0.7)',
  transition: 'border-color .25s ease, box-shadow .25s ease, transform .25s ease',
} as const;

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: tokens.accent },
    background: { default: tokens.bg, paper: '#0f1623' },
    text: { primary: tokens.textPrimary, secondary: tokens.textSecondary },
    divider: tokens.panelBorder,
    warning: { main: '#fbbf24' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Inter Variable", "Segoe UI", system-ui, sans-serif',
    h1: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: tokens.textSecondary },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { colorScheme: 'dark' },
        body: {
          backgroundColor: tokens.bg,
          backgroundImage: [
            `radial-gradient(900px 500px at 12% -10%, ${alpha(tokens.accentDeep, 0.22)}, transparent 60%)`,
            `radial-gradient(700px 420px at 95% 5%, ${alpha(tokens.accent2, 0.16)}, transparent 60%)`,
            `linear-gradient(${tokens.grid} 1px, transparent 1px)`,
            `linear-gradient(90deg, ${tokens.grid} 1px, transparent 1px)`,
          ].join(','),
          backgroundSize: 'auto, auto, 44px 44px, 44px 44px',
          backgroundAttachment: 'fixed',
        },
        '::-webkit-scrollbar': { width: 10, height: 10 },
        '::-webkit-scrollbar-thumb': { background: 'rgba(148,163,184,0.25)', borderRadius: 10 },
        '::-webkit-scrollbar-track': { background: 'transparent' },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { ...glass, backgroundImage: 'none', '&:hover': { borderColor: tokens.panelBorderHover } } },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: 'rgba(148,163,184,0.08)', fontVariantNumeric: 'tabular-nums' },
        head: { fontWeight: 600, color: tokens.textSecondary, backgroundColor: '#0d1422', fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase' },
      },
    },
    MuiTableRow: { styleOverrides: { hover: { '&:hover': { backgroundColor: `${alpha(tokens.accent, 0.06)} !important` } } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          '& fieldset': { borderColor: tokens.panelBorder },
          '&:hover fieldset': { borderColor: `${alpha(tokens.accent, 0.5)} !important` },
          '&.Mui-focused fieldset': { borderColor: `${tokens.accent} !important`, boxShadow: `0 0 0 3px ${alpha(tokens.accent, 0.15)}` },
        },
      },
    },
    MuiChip: { styleOverrides: { root: { backgroundColor: alpha(tokens.accent, 0.14), color: tokens.textPrimary, borderRadius: 8 } } },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: 'none', color: tokens.textSecondary, borderColor: tokens.panelBorder,
          '&.Mui-selected': { color: tokens.bg, backgroundColor: tokens.accent, '&:hover': { backgroundColor: tokens.accent } },
        },
      },
    },
    MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 10, fontWeight: 600 } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 14, backdropFilter: 'blur(10px)' } } },
  },
});
