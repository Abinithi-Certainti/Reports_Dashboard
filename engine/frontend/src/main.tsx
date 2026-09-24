import React, { useCallback, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { buildTheme, ThemeName, themes, TokensContext } from './theme';
import { play, SoundContext, SoundName } from './sound';
import { PrefsContext } from './prefs';
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
  const [themeName, setThemeNameState] = useState<ThemeName>(() => stored('re.theme', 'neon', Object.keys(themes)));
  const [soundOn, setSoundOn] = useState<boolean>(() => stored('re.sound', 'on', ['on', 'off']) === 'on');

  const setThemeName = useCallback((t: ThemeName) => {
    setThemeNameState(t);
    save('re.theme', t);
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

  const tokens = themes[themeName];
  const muiTheme = useMemo(() => buildTheme(tokens), [tokens]);

  return (
    <PrefsContext.Provider value={{ themeName, setThemeName }}>
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
