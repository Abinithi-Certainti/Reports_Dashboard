import { createContext } from 'react';
import type { ThemeName } from './theme';

// The viewer's look: chosen in the Customize panel, remembered in this browser only.
export type AccentName = 'cyan' | 'emerald' | 'sunset' | 'royal' | 'rose';
export type FontName = 'inter' | 'manrope' | 'jakarta' | 'plex';
export type NumbersName = 'mono' | 'same';
export type SizeName = 'big' | 'compact' | 'dense';
export type LayoutName = 'side' | 'rail' | 'top';

export type Look = { theme: ThemeName; accent: AccentName; font: FontName; numbers: NumbersName; size: SizeName; layout: LayoutName };
export const DEFAULT_LOOK: Look = { theme: 'neon', accent: 'cyan', font: 'inter', numbers: 'mono', size: 'compact', layout: 'side' };

/** Accent colours: [accent, second accent, chart colour, lighter chart colour] for dark and for light pages. */
export const ACCENTS: Record<AccentName, { label: string; dark: [string, string, string, string]; light: [string, string, string, string] }> = {
  cyan: { label: 'Cyan + violet', dark: ['#22d3ee', '#a78bfa', '#3b82f6', '#22d3ee'], light: ['#0891b2', '#7c3aed', '#2563eb', '#06b6d4'] },
  emerald: { label: 'Emerald + teal', dark: ['#34d399', '#2dd4bf', '#10b981', '#6ee7b7'], light: ['#059669', '#0d9488', '#059669', '#34d399'] },
  sunset: { label: 'Amber + coral', dark: ['#fbbf24', '#fb7185', '#f97316', '#fbbf24'], light: ['#d97706', '#e11d48', '#ea580c', '#f59e0b'] },
  royal: { label: 'Royal blue + indigo', dark: ['#60a5fa', '#818cf8', '#3b82f6', '#93c5fd'], light: ['#2563eb', '#4f46e5', '#2563eb', '#60a5fa'] },
  rose: { label: 'Rose + magenta', dark: ['#f472b6', '#e879f9', '#ec4899', '#f9a8d4'], light: ['#db2777', '#c026d3', '#db2777', '#f472b6'] },
};
export const FONTS: Record<FontName, { label: string; family: string }> = {
  inter: { label: 'Inter', family: '"Inter Variable"' },
  manrope: { label: 'Manrope', family: '"Manrope Variable"' },
  jakarta: { label: 'Plus Jakarta Sans', family: '"Plus Jakarta Sans Variable"' },
  plex: { label: 'IBM Plex Sans', family: '"IBM Plex Sans Variable"' },
};
/** Root font size and MUI spacing unit per size: everything in rem and theme spacing scales with it. */
export const SIZES: Record<SizeName, { label: string; rootPx: number; spacing: number }> = {
  big: { label: 'Big', rootPx: 16, spacing: 8 },
  compact: { label: 'Compact', rootPx: 14.5, spacing: 7 },
  dense: { label: 'Extra compact', rootPx: 13, spacing: 6 },
};
export const LAYOUTS: Record<LayoutName, string> = { side: 'Side menu', rail: 'Slim icon rail', top: 'Top menu' };
export const NUMBERS: Record<NumbersName, string> = { mono: 'Code style', same: 'Same as text' };

export type Prefs = { look: Look; setLook: (patch: Partial<Look>) => void };
export const PrefsContext = createContext<Prefs>({ look: DEFAULT_LOOK, setLook: () => {} });
