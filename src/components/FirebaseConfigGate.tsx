import type { ReactNode } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { getSupabaseConfigStatus } from '@/lib/supabase';

type Props = { children: ReactNode };

/**
 * Renders a setup message when Supabase is only partly configured.
 */
export function FirebaseConfigGate({ children }: Props) {
  const { ok, missing } = getSupabaseConfigStatus();
  if (ok) {
    return <>{children}</>;
  }
  return (
    <Box sx={{ p: 3, maxWidth: 560, mx: 'auto', mt: 6 }}>
      <Alert severity="warning">
        <Typography variant="subtitle1" gutterBottom>
          Supabase is not configured
        </Typography>
        <Typography variant="body2" sx={{ mb: 1.5 }}>
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> from Supabase → Project Settings → API.
          Locally, copy <code style={{ userSelect: 'all' }}>.env.example</code> to <code style={{ userSelect: 'all' }}>.env</code>.
          On Vercel, add the same names under Project → Settings → Environment Variables, then redeploy (Vite reads them at build time).
        </Typography>
        <Typography variant="body2" sx={{ mb: 1.5 }} color="text.secondary">
          If you want offline demo mode instead, leave both Supabase variables empty (or set{' '}
          <code style={{ userSelect: 'all' }}>VITE_LOCAL_DEMO=true</code>) and redeploy.
        </Typography>

        <Typography variant="body2" component="div" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
          Missing: {missing.join(', ')}
        </Typography>
      </Alert>
    </Box>
  );
}
