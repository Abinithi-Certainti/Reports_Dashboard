import type { DataSource } from './api';
import type { Tokens } from './theme';

/** How each data source is named and coloured, the same in the sidebar, the status chip and the banner. */
export const SOURCE_LABEL: Record<DataSource, string> = {
  live: 'Live DEV data',
  export: 'DEV export',
  sample: 'Sample data - made up',
};
export const SAMPLE_ORANGE = '#f97316';
export const EXPORT_BLUE = '#3b82f6';
export const sourceColour = (s: DataSource, t: Tokens) => (s === 'live' ? t.good : s === 'export' ? EXPORT_BLUE : SAMPLE_ORANGE);
