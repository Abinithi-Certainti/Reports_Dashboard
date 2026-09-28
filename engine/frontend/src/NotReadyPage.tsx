import { Box, Container, Paper, Typography } from '@mui/material';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import { alpha } from '@mui/material/styles';
import { useTokens } from './theme';
import { isStaticDemo } from './api';
import { CatalogEntry } from './catalog';
import ReportHeader from './components/ReportHeader';

/** Shown for a report in the list that cannot show numbers here: its reason, in plain words. No made-up rows. */
export default function NotReadyPage({ entry }: { entry: CatalogEntry }) {
  const t = useTokens();
  const blocked = !!entry.whyNot;
  const colour = blocked ? t.textMuted : '#f59e0b';
  const text = entry.whyNot
    ?? (isStaticDemo
      ? 'The report is built, but its DEV export is not loaded into this copy yet. It appears here as soon as the export is added.'
      : 'The engine could not load this report. Check the backend log for the reason.');
  return (
    <Container maxWidth={false} sx={{ py: 3, maxWidth: 1500 }}>
      <ReportHeader entry={entry} status={blocked ? 'Cannot show yet' : 'DEV data not loaded'} statusColour={colour} />
      <Paper sx={{ p: { xs: 3, md: 6 }, display: 'grid', placeItems: 'center', textAlign: 'center', minHeight: 320 }}>
        <Box
          sx={{
            width: 76, height: 76, borderRadius: '22px', display: 'grid', placeItems: 'center', mb: 2.5, position: 'relative',
            color: colour, background: alpha(colour, 0.12), border: `1px solid ${alpha(colour, 0.4)}`,
            '&::after': {
              content: '""', position: 'absolute', inset: -8, borderRadius: '28px', border: `1px dashed ${alpha(colour, 0.45)}`,
              animation: 'turn 14s linear infinite', '@keyframes turn': { to: { transform: 'rotate(360deg)' } },
            },
          }}
        >
          {blocked ? <BlockRoundedIcon sx={{ fontSize: 34 }} /> : <HourglassTopRoundedIcon sx={{ fontSize: 34 }} />}
        </Box>
        <Typography sx={{ fontSize: '1.15rem', fontWeight: 700, color: t.textPrimary, mb: 1 }}>
          {blocked ? 'No data to show yet' : 'Waiting for DEV data'}
        </Typography>
        <Typography sx={{ color: t.textSecondary, maxWidth: 560 }}>{text}</Typography>
      </Paper>
    </Container>
  );
}
