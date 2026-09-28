import React, { useCallback, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { buildTheme, lookTokens, themes, TokensContext } from './theme';
import { play, SoundContext, SoundName } from './sound';
import { ACCENTS, DEFAULT_LOOK, FONTS, LAYOUTS, Look, NUMBERS, PrefsContext, SIZES } from './prefs';
import App from './App';

// Per-viewer preferences. Storage can be blocked (private windows), so every access is guarded.
function stored<T extends string>(key: string, fallback: T, allowed: readonly string[]): T {
  try {
    const v = localStorage.getItem(key);
    return v && allowed.includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* preference just won't persist */
  }
}

function Root() {
  const [look, setLookState] = useState<Look>(() => ({
    theme: stored('re.theme', DEFAULT_LOOK.theme, Object.keys(themes)),
    accent: stored('re.accent', DEFAULT_LOOK.accent, Object.keys(ACCENTS)),
    font: stored('re.font', DEFAULT_LOOK.font, Object.keys(FONTS)),
    numbers: stored('re.numbers', DEFAULT_LOOK.numbers, Object.keys(NUMBERS)),
    size: stored('re.size', DEFAULT_LOOK.size, Object.keys(SIZES)),
    layout: stored('re.layout', DEFAULT_LOOK.layout, Object.keys(LAYOUTS)),
  }));
  const [soundOn, setSoundOn] = useState<boolean>(() => stored('re.sound', 'on', ['on', 'off']) === 'on');

  const setLook = useCallback((patch: Partial<Look>) => {
    setLookState((old) => ({ ...old, ...patch }));
    for (const [k, v] of Object.entries(patch)) save(`re.${k}`, v);
  }, []);
  const setEnabled = useCallback((on: boolean) => {
    setSoundOn(on);
    save('re.sound', on ? 'on' : 'off');
    if (on) play('toggle');
  }, []);
  const sound = useMemo(
    () => ({ enabled: soundOn, setEnabled, play: (n: SoundName) => soundOn && play(n) }),
    [soundOn, setEnabled],
  );

  const tokens = useMemo(() => lookTokens(look), [look]);
  const muiTheme = useMemo(() => buildTheme(tokens, look), [tokens, look]);

  return (
    <PrefsContext.Provider value={{ look, setLook }}>
      <TokensContext.Provider value={tokens}>
        <SoundContext.Provider value={sound}>
          <ThemeProvider theme={muiTheme}>
            <CssBaseline />
            <App />
          </ThemeProvider>
        </SoundContext.Provider>
      </TokensContext.Provider>
    </PrefsContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
