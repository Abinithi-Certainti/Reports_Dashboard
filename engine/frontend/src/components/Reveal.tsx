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
          '@keyframes reveal': { from: { opacity: 0, transform: 'translateY(14px) scale(.985)' }, to: { opacity: 1, transform: 'none' } },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}
