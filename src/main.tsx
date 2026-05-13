import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FirebaseConfigGate } from '@/components/FirebaseConfigGate';
import { AuthProvider } from '@/context/AuthContext';
import App from './App.tsx';
import './index.css';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0d47a1' },
    secondary: { main: '#b71c1c' },
  },
  typography: {
    fontFamily: ['Roboto', 'system-ui', 'sans-serif'].join(','),
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <BrowserRouter>
          <FirebaseConfigGate>
            <AuthProvider>
              <App />
            </AuthProvider>
          </FirebaseConfigGate>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
);
