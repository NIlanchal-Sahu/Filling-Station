import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FirebaseConfigGate } from '@/components/FirebaseConfigGate';
import { AuthProvider } from '@/context/AuthContext';
import { StationAboutProvider } from '@/context/StationAboutContext';
import { ThemeModeProvider } from '@/context/ThemeModeContext';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeModeProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <FirebaseConfigGate>
            <AuthProvider>
              <StationAboutProvider>
                <App />
              </StationAboutProvider>
            </AuthProvider>
          </FirebaseConfigGate>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeModeProvider>
  </StrictMode>,
);
