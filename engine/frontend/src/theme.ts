import { createTheme } from '@mui/material/styles';

// One look for every report. Chart colours follow the data-viz reference palette (series-1 blue);
// text always uses text colours, never the chart colour.
export const chartColors = {
  series1: '#2a78d6',
  grid: '#e6e6e3',
  axisText: '#52514e',
  surface: '#ffffff',
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0b3d6e' },
    background: { default: '#f5f6f8', paper: '#ffffff' },
    text: { primary: '#0b0b0b', secondary: '#52514e' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
    h1: { fontSize: '1.6rem', fontWeight: 650 },
    h2: { fontSize: '1rem', fontWeight: 600 },
  },
  components: {
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { border: '1px solid #e3e5e8' } } },
    MuiTableCell: { styleOverrides: { root: { borderColor: '#eceef1' }, head: { fontWeight: 600, color: '#52514e' } } },
  },
});
