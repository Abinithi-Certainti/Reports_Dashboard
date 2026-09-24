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
  panelHighlight: string; // soft light along the top edge of every panel (depth)
  panelBorder: string;
  panelBorderHover: string;
  sidebar: string;
  headerBar: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;       // interactive accent (buttons, focus, highlights)
  accent2: string;      // second accent, for gradients
  series1: string;      // chart series colour (single-series charts)
  series1Light: string; // lighter end of the bar gradient
  palette: string[];    // categorical colours, in order (donut slices, KPI tiles)
  aurora: [string, string, string]; // three slow-moving background glows
  auroraOpacity: number;
  glow: string;         // '' = no glow in this theme
  grid: string;
  headerCell: string;
  good: string;
  bad: string;
  mono: string;
  blur: string;
};

const mono = '"JetBrains Mono Variable", ui-monospace, monospace';
const gridLines = (c: string) => [`linear-gradient(${c} 1px, transparent 1px)`, `linear-gradient(90deg, ${c} 1px, transparent 1px)`].join(',');

// Light: bright glass on a cool wash. Midnight: deep navy wallboard with a soft aurora.
// Neon: deep space, glass panels, glow and a moving aurora.
export const themes: Record<ThemeName, Tokens> = {
  light: {
    name: 'light', label: 'Light', mode: 'light',
    bg: '#eef2f8', bgImage: 'none',
    panel: 'rgba(255,255,255,0.86)', panelSolid: '#ffffff', panelHighlight: 'linear-gradient(180deg, rgba(255,255,255,0.9), rgba(255,255,255,0) 40%)',
    panelBorder: '#e2e7f0', panelBorderHover: '#a9c4f5', sidebar: 'rgba(255,255,255,0.78)', headerBar: 'rgba(238,242,248,0.78)',
    textPrimary: '#0b1324', textSecondary: '#4e5a70', textMuted: '#8390a5',
    accent: '#2563eb', accent2: '#7c3aed', series1: '#2563eb', series1Light: '#60a5fa',
    palette: ['#2563eb', '#7c3aed', '#0891b2', '#db2777', '#d97706', '#059669'],
    aurora: ['#93c5fd', '#c4b5fd', '#99f6e4'], auroraOpacity: 0.45, glow: '',
    grid: '#e8ecf3', headerCell: '#f5f7fb', good: '#0f8a4f', bad: '#c93434', mono, blur: 'blur(12px) saturate(160%)',
  },
  midnight: {
    name: 'midnight', label: 'Midnight', mode: 'dark',
    bg: '#0a1120', bgImage: 'none',
    panel: 'rgba(21,30,48,0.82)', panelSolid: '#151e30', panelHighlight: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0) 35%)',
    panelBorder: 'rgba(148,163,184,0.13)', panelBorderHover: 'rgba(96,165,250,0.45)',
    sidebar: 'rgba(8,13,26,0.85)', headerBar: 'rgba(10,17,32,0.7)',
    textPrimary: '#f1f5f9', textSecondary: '#a3adbf', textMuted: '#6b7588',
    accent: '#60a5fa', accent2: '#a78bfa', series1: '#3b82f6', series1Light: '#60a5fa',
    palette: ['#60a5fa', '#a78bfa', '#22d3ee', '#f472b6', '#fbbf24', '#34d399'],
    aurora: ['#1d4ed8', '#6d28d9', '#0e7490'], auroraOpacity: 0.28, glow: '',
    grid: 'rgba(148,163,184,0.10)', headerCell: '#121a2b', good: '#34d399', bad: '#f87171', mono, blur: 'blur(10px) saturate(130%)',
  },
  neon: {
    name: 'neon', label: 'Neon', mode: 'dark',
    bg: '#04060d',
    bgImage: gridLines('rgba(148,163,184,0.06)'),
    panel: 'rgba(12,18,32,0.58)', panelSolid: '#0c1220', panelHighlight: 'linear-gradient(180deg, rgba(34,211,238,0.07), rgba(34,211,238,0) 30%)',
    panelBorder: 'rgba(148,163,184,0.15)', panelBorderHover: 'rgba(34,211,238,0.55)',
    sidebar: 'rgba(4,6,13,0.7)', headerBar: 'rgba(4,6,13,0.5)',
    textPrimary: '#f1f5f9', textSecondary: '#94a3b8', textMuted: '#64748b',
    accent: '#22d3ee', accent2: '#a78bfa', series1: '#3b82f6', series1Light: '#22d3ee',
    palette: ['#22d3ee', '#a78bfa', '#f472b6', '#60a5fa', '#facc15', '#4ade80'],
    aurora: ['#0891b2', '#7c3aed', '#db2777'], auroraOpacity: 0.34, glow: 'rgba(34,211,238,0.35)',
    grid: 'rgba(148,163,184,0.10)', headerCell: '#0a1020', good: '#34d399', bad: '#f87171', mono, blur: 'blur(16px) saturate(150%)',
  },
};

export const TokensContext = createContext<Tokens>(themes.neon);
export const useTokens = () => useContext(TokensContext);

export function panelSx(t: Tokens) {
  return {
    background: t.panel,
    backgroundImage: t.panelHighlight,
    backdropFilter: t.blur,
    border: `1px solid ${t.panelBorder}`,
    borderRadius: '18px',
    boxShadow: t.mode === 'light'
      ? '0 1px 2px rgba(15,23,42,0.04), 0 12px 32px -16px rgba(30,58,138,0.18)'
      : '0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 48px -28px rgba(0,0,0,0.8)',
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
            backgroundSize: t.name === 'neon' ? '44px 44px, 44px 44px' : undefined,
            backgroundAttachment: 'fixed',
            transition: 'background-color .4s ease',
          },
          '::-webkit-scrollbar': { width: 10, height: 10 },
          '::-webkit-scrollbar-thumb': { background: alpha(t.textMuted, 0.35), borderRadius: 10 },
          '::-webkit-scrollbar-track': { background: 'transparent' },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': {
              animationDuration: '0.01ms !important', animationIterationCount: '1 !important', transitionDuration: '0.01ms !important',
            },
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            ...panelSx(t),
            '&:hover': {
              borderColor: t.panelBorderHover,
              boxShadow: t.mode === 'light'
                ? `0 1px 2px rgba(15,23,42,0.04), 0 18px 40px -18px ${alpha(t.accent, 0.35)}`
                : `0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 48px -28px rgba(0,0,0,0.8), 0 0 0 1px ${alpha(t.accent, 0.12)}, 0 0 32px -12px ${t.glow || alpha(t.accent, 0.35)}`,
            },
          },
        },
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
    palette: t.palette,
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
