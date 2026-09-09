import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FirebaseConfigGate } from '@/components/FirebaseConfigGate';
import { AuthProvider } from '@/context/AuthContext';
import { theme } from '@/theme/theme';
import App from './App.tsx';
import './index.css';

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
