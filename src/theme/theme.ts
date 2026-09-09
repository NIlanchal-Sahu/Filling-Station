import { createTheme } from '@mui/material/styles';

export const DRAWER_WIDTH = 260;

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0d47a1' },
    secondary: { main: '#b71c1c' },
    success: { main: '#2e7d32' },
    background: {
      default: '#f5f7fa',
      paper: '#ffffff',
    },
  },
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
});
