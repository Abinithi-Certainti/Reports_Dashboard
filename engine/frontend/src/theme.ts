import { createContext, useContext } from 'react';
import { alpha, createTheme, Theme } from '@mui/material/styles';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';

export type ThemeName = 'light' | 'midnight' | 'neon';

export type Tokens = {
  name: ThemeName;
  label: string;
  mode: 'light' | 'dark';
  bg: string;
  bgImage: string;
  panel: string;
  panelSolid: string;
  panelBorder: string;
  panelBorderHover: string;
  sidebar: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;       // interactive accent (buttons, focus, highlights)
  series1: string;      // chart series colour (data-viz reference palette, series 1, per mode)
  series1Light: string; // lighter end of the bar gradient
  glow: string;         // '' = no glow in this theme
  grid: string;
  headerCell: string;
  good: string;
  bad: string;
  mono: string;
  blur: string;
};

const mono = '"JetBrains Mono Variable", ui-monospace, monospace';

// Light: clean white cards on soft grey, like the reference dashboards. Midnight: navy wallboard style.
// Neon: deep space with glass panels and glow.
export const themes: Record<ThemeName, Tokens> = {
  light: {
    name: 'light', label: 'Light', mode: 'light',
    bg: '#f3f5f9', bgImage: 'none',
    panel: '#ffffff', panelSolid: '#ffffff', panelBorder: '#e6e9f0', panelBorderHover: '#b9d3f5', sidebar: '#ffffff',
    textPrimary: '#0f172a', textSecondary: '#5b6475', textMuted: '#8a93a4',
    accent: '#2a78d6', series1: '#2a78d6', series1Light: '#5b9ce6', glow: '',
    grid: '#eceff4', headerCell: '#f6f8fb', good: '#0f8a4f', bad: '#c93434', mono, blur: 'none',
  },
  midnight: {
    name: 'midnight', label: 'Midnight', mode: 'dark',
    bg: '#111827', bgImage: 'none',
    panel: '#1a2334', panelSolid: '#1a2334', panelBorder: 'rgba(148,163,184,0.12)', panelBorderHover: 'rgba(56,189,248,0.40)',
    sidebar: '#0d1422',
    textPrimary: '#f1f5f9', textSecondary: '#a3adbf', textMuted: '#6b7588',
    accent: '#38bdf8', series1: '#3987e5', series1Light: '#38bdf8', glow: '',
    grid: 'rgba(148,163,184,0.10)', headerCell: '#151e2e', good: '#34d399', bad: '#f87171', mono, blur: 'none',
  },
  neon: {
    name: 'neon', label: 'Neon', mode: 'dark',
    bg: '#070b14',
    bgImage: [
      'radial-gradient(900px 500px at 12% -10%, rgba(57,135,229,0.22), transparent 60%)',
      'radial-gradient(700px 420px at 95% 5%, rgba(167,139,250,0.16), transparent 60%)',
      'linear-gradient(rgba(148,163,184,0.07) 1px, transparent 1px)',
      'linear-gradient(90deg, rgba(148,163,184,0.07) 1px, transparent 1px)',
    ].join(','),
    panel: 'rgba(17,24,39,0.62)', panelSolid: '#0f1623', panelBorder: 'rgba(148,163,184,0.14)', panelBorderHover: 'rgba(56,189,248,0.45)',
    sidebar: 'rgba(7,11,20,0.72)',
    textPrimary: '#f1f5f9', textSecondary: '#94a3b8', textMuted: '#64748b',
    accent: '#38bdf8', series1: '#3987e5', series1Light: '#38bdf8', glow: 'rgba(56,189,248,0.35)',
    grid: 'rgba(148,163,184,0.10)', headerCell: '#0d1422', good: '#34d399', bad: '#f87171', mono, blur: 'blur(14px) saturate(140%)',
  },
};

export const TokensContext = createContext<Tokens>(themes.neon);
export const useTokens = () => useContext(TokensContext);

export function panelSx(t: Tokens) {
  return {
    background: t.panel,
    backdropFilter: t.blur,
    border: `1px solid ${t.panelBorder}`,
    borderRadius: '18px',
    boxShadow: t.mode === 'light'
      ? '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -12px rgba(15,23,42,0.10)'
      : '0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 40px -24px rgba(0,0,0,0.7)',
    transition: 'border-color .25s ease, box-shadow .25s ease, transform .25s ease, background-color .4s ease',
  } as const;
}

export function buildTheme(t: Tokens): Theme {
  return createTheme({
    palette: {
      mode: t.mode,
      primary: { main: t.accent },
      background: { default: t.bg, paper: t.panelSolid },
      text: { primary: t.textPrimary, secondary: t.textSecondary },
      divider: t.panelBorder,
      success: { main: t.good },
      error: { main: t.bad },
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: '"Inter Variable", "Segoe UI", system-ui, sans-serif',
      h1: { fontSize: '1.9rem', fontWeight: 700, letterSpacing: '-0.02em' },
      h2: { fontSize: '0.78rem', fontWeight: 650, letterSpacing: '0.10em', textTransform: 'uppercase', color: t.textSecondary },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { colorScheme: t.mode },
          body: {
            backgroundColor: t.bg,
            backgroundImage: t.bgImage,
            backgroundSize: t.name === 'neon' ? 'auto, auto, 44px 44px, 44px 44px' : undefined,
            backgroundAttachment: 'fixed',
            transition: 'background-color .4s ease',
          },
          '::-webkit-scrollbar': { width: 10, height: 10 },
          '::-webkit-scrollbar-thumb': { background: alpha(t.textMuted, 0.35), borderRadius: 10 },
          '::-webkit-scrollbar-track': { background: 'transparent' },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': { animationDuration: '0.01ms !important', transitionDuration: '0.01ms !important' },
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { ...panelSx(t), backgroundImage: 'none', '&:hover': { borderColor: t.panelBorderHover } } },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: t.mode === 'light' ? '#eef1f5' : 'rgba(148,163,184,0.08)', fontVariantNumeric: 'tabular-nums' },
          head: {
            fontWeight: 650, color: t.textSecondary, backgroundColor: t.headerCell,
            fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase',
          },
        },
      },
      MuiTableRow: { styleOverrides: { hover: { '&:hover': { backgroundColor: `${alpha(t.accent, 0.06)} !important` } } } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundColor: t.mode === 'light' ? '#f8fafc' : 'rgba(15,23,42,0.6)',
            '& fieldset': { borderColor: t.panelBorder },
            '&:hover fieldset': { borderColor: `${alpha(t.accent, 0.5)} !important` },
            '&.Mui-focused fieldset': { borderColor: `${t.accent} !important`, boxShadow: `0 0 0 3px ${alpha(t.accent, 0.15)}` },
          },
        },
      },
      MuiChip: { styleOverrides: { root: { borderRadius: 8 } } },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: 'none', color: t.textSecondary, borderColor: t.panelBorder,
            '&.Mui-selected': { color: t.mode === 'light' ? '#fff' : t.bg, backgroundColor: t.accent, '&:hover': { backgroundColor: t.accent } },
          },
        },
      },
      MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 10, fontWeight: 600 } } },
      MuiAlert: { styleOverrides: { root: { borderRadius: 14 } } },
      MuiTooltip: { styleOverrides: { tooltip: { fontSize: '0.78rem' } } },
    },
  });
}

/** Chart colours for ECharts (canvas cannot read CSS variables, so values are passed in). */
export function chartTheme(t: Tokens) {
  return {
    series1: t.series1,
    series1Light: t.series1Light,
    grid: t.grid,
    axisText: t.textSecondary,
    tooltip: {
      backgroundColor: t.panelSolid,
      borderColor: t.panelBorder,
      textStyle: { color: t.textPrimary, fontSize: 12 },
      extraCssText: t.mode === 'light' ? 'box-shadow: 0 8px 24px rgba(15,23,42,.12); border-radius: 10px;' : 'border-radius: 10px;',
    },
  };
}
