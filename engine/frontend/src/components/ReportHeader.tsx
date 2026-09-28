import { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { useTokens } from '../theme';
import { CatalogEntry } from '../catalog';

/** Report title block: number, an animated gradient title, subtitle and optional right-hand content. */
export default function ReportHeader({ entry, subtitle, right }: { entry: CatalogEntry; subtitle?: string; right?: ReactNode }) {
  const t = useTokens();
  return (
    <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25, flexWrap: 'wrap' }}>
          <Typography sx={{ fontFamily: t.mono, fontSize: '0.72rem', letterSpacing: '0.14em', color: t.accent, fontWeight: 700 }}>
            REPORT {String(entry.no).padStart(2, '0')} / 10
          </Typography>
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
        {subtitle && <Typography sx={{ color: t.textSecondary, fontSize: '0.9rem' }}>{subtitle}</Typography>}
      </Box>
      {right}
    </Box>
  );
}
