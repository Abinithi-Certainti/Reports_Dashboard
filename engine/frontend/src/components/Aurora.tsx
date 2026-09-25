import { Box } from '@mui/material';
import { useTokens } from '../theme';

/**
 * Three large, blurred colour glows that drift slowly behind the page (40-60 s loops), for depth.
 * Purely decorative: fixed, behind everything, ignores the mouse, and stands still when the viewer prefers less motion.
 */
export default function Aurora() {
  const t = useTokens();
  const blob = (colour: string, size: string, pos: Record<string, string>, anim: string, secs: number) => ({
    position: 'absolute', width: size, height: size, borderRadius: '50%', ...pos,
    background: `radial-gradient(circle at center, ${colour}, transparent 65%)`,
    opacity: t.auroraOpacity, filter: 'blur(40px)', animation: `${anim} ${secs}s ease-in-out infinite alternate`,
    transition: 'opacity .6s ease, background .6s ease',
  }) as const;
  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none',
        '@keyframes driftA': { from: { transform: 'translate(0,0) scale(1)' }, to: { transform: 'translate(18vw, 12vh) scale(1.15)' } },
        '@keyframes driftB': { from: { transform: 'translate(0,0) scale(1.1)' }, to: { transform: 'translate(-16vw, 18vh) scale(0.9)' } },
        '@keyframes driftC': { from: { transform: 'translate(0,0) scale(0.95)' }, to: { transform: 'translate(10vw, -14vh) scale(1.2)' } },
        '@media (prefers-reduced-motion: reduce)': { '& > *': { animation: 'none !important' } },
      }}
    >
      <Box sx={blob(t.aurora[0], '60vmax', { left: '-18vmax', top: '-22vmax' }, 'driftA', 46)} />
      <Box sx={blob(t.aurora[1], '52vmax', { right: '-16vmax', top: '-12vmax' }, 'driftB', 58)} />
      <Box sx={blob(t.aurora[2], '48vmax', { left: '30vw', bottom: '-30vmax' }, 'driftC', 52)} />
    </Box>
  );
}
