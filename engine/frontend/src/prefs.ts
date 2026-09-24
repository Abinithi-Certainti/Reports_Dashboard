import { createContext } from 'react';
import { ThemeName } from './theme';

export type Prefs = { themeName: ThemeName; setThemeName: (t: ThemeName) => void };
export const PrefsContext = createContext<Prefs>({ themeName: 'neon', setThemeName: () => {} });
