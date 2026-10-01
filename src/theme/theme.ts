import { createTheme, type PaletteMode } from '@mui/material/styles';

export const DRAWER_WIDTH = 260;

const shared = {
  typography: {
    fontFamily: ['Roboto', 'system-ui', 'sans-serif'].join(','),
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid',
          borderColor: 'divider',
        },
      },
    },
  },
} as const;

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === 'dark';

  return createTheme({
    ...shared,
    palette: {
      mode,
      primary: { main: isDark ? '#64b5f6' : '#0d47a1' },
      secondary: { main: isDark ? '#ef5350' : '#b71c1c' },
      success: { main: isDark ? '#66bb6a' : '#2e7d32' },
      background: {
        default: isDark ? '#0a0e1a' : '#f5f7fa',
        paper: isDark ? '#121829' : '#ffffff',
      },
    },
  });
}

/** @deprecated Use createAppTheme via ThemeModeProvider */
export const theme = createAppTheme('light');

export const THEME_COLOR = {
  light: '#0d47a1',
  dark: '#0a0e1a',
} as const;
