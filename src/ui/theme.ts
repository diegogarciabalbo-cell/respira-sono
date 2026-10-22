import { useColorScheme } from 'react-native';
import { useApp } from '../state/AppContext';

export interface Theme {
  dark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  accent: string; // verde suave
  accentSoft: string;
  border: string;
  warn: string;
  warnSoft: string;
  danger: string;
  dangerSoft: string;
  demo: string;
  fs: (size: number) => number;
}

const light = {
  dark: false,
  bg: '#F4F7FB',
  surface: '#FFFFFF',
  surfaceAlt: '#E8EFF8',
  text: '#0E2340',
  textMuted: '#4A5D78',
  primary: '#1C4E8A',
  primaryText: '#FFFFFF',
  accent: '#2F7D5B',
  accentSoft: '#DDF0E6',
  border: '#CAD6E6',
  warn: '#8A5A00',
  warnSoft: '#FFF2D6',
  danger: '#A12B2B',
  dangerSoft: '#FBE3E3',
  demo: '#6B4FA3',
};

const dark = {
  dark: true,
  bg: '#08121F',
  surface: '#102035',
  surfaceAlt: '#18304D',
  text: '#E7EEF8',
  textMuted: '#A5B6CC',
  primary: '#7FB0EE',
  primaryText: '#08121F',
  accent: '#7CCCA5',
  accentSoft: '#173A2C',
  border: '#27415F',
  warn: '#F2C46B',
  warnSoft: '#3A2E12',
  danger: '#F29A9A',
  dangerSoft: '#3D1A1A',
  demo: '#C3AEF0',
};

export function useTheme(): Theme {
  const system = useColorScheme();
  const { prefs } = useApp();
  const mode = prefs.themeMode === 'system' ? system ?? 'light' : prefs.themeMode;
  const base = mode === 'dark' ? dark : light;
  const scale = prefs.fontScale;
  return { ...base, fs: (s: number) => Math.round(s * scale) };
}
