import type { ReactNode } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { getFirebaseConfigStatus } from '@/lib/firebase';

type Props = { children: ReactNode };

/**
 * Renders a clear setup message when VITE_* Firebase keys are missing (local dev / misconfiguration).
 */
export function FirebaseConfigGate({ children }: Props) {
  const { ok, missing } = getFirebaseConfigStatus();
  if (ok) {
    return <>{children}</>;
  }
  return (
    <Box sx={{ p: 3, maxWidth: 560, mx: 'auto', mt: 6 }}>
      <Alert severity="warning">
        <Typography variant="subtitle1" gutterBottom>
          Firebase is not configured
        </Typography>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          Set every <code>VITE_FIREBASE_*</code> value from Firebase Console → Project settings → Your apps. Locally, copy{' '}
          <code style={{ userSelect: 'all' }}>.env.example</code> to <code style={{ userSelect: 'all' }}>.env</code>. On Vercel,
          add the same names under Project → Settings → Environment Variables, then redeploy (Vite reads them at build time).
        </Typography>
        <Typography variant="body2" sx={{ mb: 1.5 }} color="text.secondary">
          Tip: <code style={{ userSelect: 'all' }}>npm run dev</code> with no Firebase variables uses offline demo storage in this
          browser. To force that on a Vercel preview, set <code style={{ userSelect: 'all' }}>VITE_LOCAL_DEMO=true</code>.
        </Typography>

        <Typography variant="body2" component="div" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
          Missing: {missing.join(', ')}
        </Typography>
      </Alert>
    </Box>
  );
}
