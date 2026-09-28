import { Box, SxProps, Theme } from '@mui/material';
import { ReactNode } from 'react';

/** Fades and lifts its content in, a little later for each block, so a page assembles itself top to bottom. */
export default function Reveal({ index, children, sx }: { index: number; children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Box
      sx={[
        {
          minWidth: 0, display: 'flex', flexDirection: 'column', '& > .MuiPaper-root': { flex: 1 },
          animation: 'reveal .7s cubic-bezier(.2,.8,.2,1) both', animationDelay: `${Math.min(index, 8) * 90}ms`,
          '@keyframes reveal': { from: { opacity: 0, transform: 'translateY(18px) scale(.98)', filter: 'blur(3px)' }, to: { opacity: 1, transform: 'none', filter: 'none' } },
          // A thin light runs along the top edge of each panel once as it appears, then again on hover.
          position: 'relative',
          '&::before': {
            content: '""', position: 'absolute', zIndex: 1, top: 0, left: 18, right: 18, height: '1px', pointerEvents: 'none',
            background: 'linear-gradient(90deg, transparent, var(--re-accent, #22d3ee), transparent)', backgroundSize: '40% 100%',
            backgroundRepeat: 'no-repeat', opacity: 0, animation: 'edge 1.6s ease-out both', animationDelay: `${Math.min(index, 8) * 90 + 300}ms`,
            '@keyframes edge': { '0%': { opacity: 0, backgroundPosition: '-40% 0' }, '20%': { opacity: 1 }, '100%': { opacity: 0, backgroundPosition: '140% 0' } },
          },
          '&:hover::before': { animation: 'edge 1.4s ease-out' },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}
