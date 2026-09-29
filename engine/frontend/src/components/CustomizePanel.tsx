import { useContext } from 'react';
import { Box, ButtonBase, Drawer, IconButton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { ThemeName, themes, useTokens } from '../theme';
import { ACCENTS, AccentName, DEFAULT_LOOK, FONTS, LAYOUTS, Look, NUMBERS, PrefsContext, SIZES } from '../prefs';
import { useSound } from '../sound';

const THEME_LABELS: Record<ThemeName, string> = { neon: 'Neon', midnight: 'Midnight', light: 'Light' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTokens();
  return (
    <Box sx={{ mb: 2.25 }}>
      <Typography sx={{ fontSize: '0.66rem', letterSpacing: '0.16em', fontWeight: 700, color: t.textMuted, mb: 1 }}>{title}</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>{children}</Box>
    </Box>
  );
}

function Choice({ on, label, onClick, children, wide }: { on: boolean; label: string; onClick: () => void; children?: React.ReactNode; wide?: boolean }) {
  const t = useTokens();
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={on}
      sx={{
        gap: 0.75, px: 1.25, py: 0.75, borderRadius: '10px', fontSize: '0.8rem', fontWeight: on ? 650 : 500,
        flexBasis: wide ? 'calc(50% - 3px)' : 'auto', justifyContent: 'flex-start',
        color: on ? t.textPrimary : t.textSecondary,
        border: `1px solid ${on ? t.accent : t.panelBorder}`,
        background: on ? alpha(t.accent, 0.12) : 'transparent',
        boxShadow: on && t.glow ? `0 0 14px -4px ${t.glow}` : 'none',
        transition: 'all .2s ease', '&:hover': { borderColor: t.accent, color: t.textPrimary },
      }}
    >
      {children}
      {label}
      {on && <CheckRoundedIcon sx={{ fontSize: 15, ml: 'auto', color: t.accent }} />}
    </ButtonBase>
  );
}

/** The Customize panel: theme, colour, font, number style, size and layout. Changes apply at once. */
export default function CustomizePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTokens();
  const sound = useSound();
  const { look, setLook } = useContext(PrefsContext);
  const pick = (patch: Partial<Look>) => { setLook(patch); sound.play('toggle'); };
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 380 }, borderRadius: 0, p: 2.5, background: t.panelSolid, backgroundImage: 'none' } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography sx={{ fontWeight: 750, fontSize: '1.05rem', color: t.textPrimary }}>Customize</Typography>
          <Typography sx={{ fontSize: '0.76rem', color: t.textMuted }}>Saved in this browser only</Typography>
        </Box>
        <IconButton aria-label="Close" onClick={onClose} sx={{ ml: 'auto' }}><CloseRoundedIcon /></IconButton>
      </Box>

      <Section title="THEME">
        {(Object.keys(THEME_LABELS) as ThemeName[]).map((name) => {
          const th = themes[name];
          const on = look.theme === name;
          return (
            <ButtonBase
              key={name}
              onClick={() => pick({ theme: name })}
              aria-pressed={on}
              sx={{
                flex: '1 1 0', flexDirection: 'column', alignItems: 'stretch', gap: 0.75, p: 0.75, borderRadius: '12px',
                border: `1px solid ${on ? t.accent : t.panelBorder}`, background: on ? alpha(t.accent, 0.08) : 'transparent',
              }}
            >
              <Box sx={{ height: 46, borderRadius: '8px', background: th.bg, border: `1px solid ${th.panelBorder}`, p: 0.75, display: 'flex', gap: 0.5, overflow: 'hidden' }}>
                <Box sx={{ width: 10, borderRadius: '3px', background: th.sidebar, border: `1px solid ${th.panelBorder}` }} />
                <Box sx={{ flex: 1, display: 'grid', gap: 0.5, gridTemplateRows: '1fr 1fr' }}>
                  <Box sx={{ borderRadius: '3px', background: th.panelSolid, borderBottom: `2px solid ${t.accent}` }} />
                  <Box sx={{ borderRadius: '3px', background: th.panelSolid }} />
                </Box>
              </Box>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: on ? 700 : 500, color: on ? t.textPrimary : t.textSecondary }}>{THEME_LABELS[name]}</Typography>
            </ButtonBase>
          );
        })}
      </Section>

      <Section title="COLOUR">
        {(Object.keys(ACCENTS) as AccentName[]).map((name) => {
          const [a, b] = ACCENTS[name][t.mode];
          return (
            <Choice key={name} wide on={look.accent === name} label={ACCENTS[name].label} onClick={() => pick({ accent: name })}>
              <Box sx={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${a}, ${b})` }} />
            </Choice>
          );
        })}
      </Section>

      <Section title="FONT">
        {(Object.keys(FONTS) as (keyof typeof FONTS)[]).map((name) => (
          <Choice key={name} wide on={look.font === name} label={FONTS[name].label} onClick={() => pick({ font: name })}>
            <Box component="span" sx={{ fontFamily: `${FONTS[name].family}, sans-serif`, fontWeight: 700, fontSize: '0.95rem', width: 22 }}>Aa</Box>
          </Choice>
        ))}
      </Section>

      <Section title="NUMBERS">
        {(Object.keys(NUMBERS) as (keyof typeof NUMBERS)[]).map((name) => (
          <Choice key={name} wide on={look.numbers === name} label={NUMBERS[name]} onClick={() => pick({ numbers: name })} />
        ))}
      </Section>

      <Section title="SIZE">
        {(Object.keys(SIZES) as (keyof typeof SIZES)[]).map((name) => (
          <Choice key={name} on={look.size === name} label={SIZES[name].label} onClick={() => pick({ size: name })} />
        ))}
      </Section>

      <Section title="LAYOUT">
        {(Object.keys(LAYOUTS) as (keyof typeof LAYOUTS)[]).map((name) => (
          <Choice key={name} on={look.layout === name} label={LAYOUTS[name]} onClick={() => pick({ layout: name })} />
        ))}
      </Section>

      <ButtonBase onClick={() => pick(DEFAULT_LOOK)} sx={{ mt: 1, fontSize: '0.8rem', color: t.accent, fontWeight: 600 }}>Back to the default look</ButtonBase>
    </Drawer>
  );
}
