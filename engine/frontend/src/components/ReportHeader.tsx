import { ReactNode } from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useTokens } from '../theme';
import { CatalogEntry } from '../catalog';

/** Report title block: number, Jira key, an animated gradient title, a status chip and optional right-hand content. */
export default function ReportHeader({ entry, subtitle, status, statusColour, right }: {
  entry: CatalogEntry; subtitle?: string; status: string; statusColour: string; right?: ReactNode;
}) {
  const t = useTokens();
  return (
    <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
          <Typography sx={{ fontFamily: t.mono, fontSize: '0.72rem', letterSpacing: '0.14em', color: t.accent, fontWeight: 700 }}>
            REPORT {String(entry.no).padStart(2, '0')} / 10
          </Typography>
          {entry.jira && <Chip size="small" label={entry.jira} sx={{ height: 20, fontSize: '0.66rem', fontFamily: t.mono, bgcolor: alpha(t.accent2, 0.14), color: t.accent2 }} />}
          <Chip
            size="small"
            label={status}
            sx={{ height: 20, fontSize: '0.66rem', fontWeight: 650, bgcolor: alpha(statusColour, 0.14), color: statusColour, border: `1px solid ${alpha(statusColour, 0.35)}` }}
          />
        </Box>
        <Typography
          variant="h1"
          sx={{
            background: `linear-gradient(90deg, ${t.textPrimary} 0%, ${t.textPrimary} 30%, ${t.accent} 55%, ${t.accent2} 75%, ${t.textPrimary} 100%)`,
            backgroundSize: '220% 100%', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
            animation: 'titleShine 9s ease-in-out infinite alternate',
            '@keyframes titleShine': { from: { backgroundPosition: '0% 0' }, to: { backgroundPosition: '100% 0' } },
          }}
        >
          {entry.title}
        </Typography>
        {subtitle && <Typography sx={{ color: t.textSecondary, mt: 0.25 }}>{subtitle}</Typography>}
      </Box>
      {right}
    </Box>
  );
}
