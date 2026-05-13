import { useEffect, useState } from 'react';
import { alpha, Box, TextField, Button, Typography, Paper, Alert, Stack, useTheme } from '@mui/material';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { requireEmail, requireNonEmpty } from '@/utils/validation';
import { LOCAL_DEMO } from '@/config/appMode';

export function LoginPage() {
  const theme = useTheme();
  const { signIn, error, loading, profile } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  useEffect(() => {
    if (!profile) {
      return;
    }
    const target =
      from && from !== '/login'
        ? from
        : profile.role === 'manager'
          ? '/manager'
          : '/operator';
    nav(target, { replace: true });
  }, [profile, from, nav]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const e1 = requireEmail(email);
    const e2 = requireNonEmpty(password, 'Password');
    if (e1 || e2) {
      setFormError(e1 ?? e2 ?? null);
      return;
    }
    setLocalLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch {
      setFormError('Invalid email or password.');
    } finally {
      setLocalLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 4,
        background: (t) =>
          t.palette.mode === 'dark'
            ? `radial-gradient(1200px circle at 20% -10%, ${alpha(t.palette.primary.main, 0.22)} 0%, transparent 50%), ${t.palette.background.default}`
            : `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${theme.palette.background.default} 42%, ${alpha(theme.palette.primary.light, 0.08)} 100%)`,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 440,
          p: { xs: 2.5, sm: 3.5 },
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: (t) => `0 24px 64px ${alpha(t.palette.common.black, t.palette.mode === 'dark' ? 0.35 : 0.1)}`,
        }}
      >
        <Stack spacing={2} sx={{ mb: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
              color: 'primary.main',
            }}
          >
            <LocalGasStationOutlinedIcon fontSize="large" />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
            PumpStock
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {LOCAL_DEMO
              ? 'Local demo — use manager@demo.local or operator@demo.local with any password. Data stays in this browser.'
              : 'Sign in with your work credentials to manage shifts, credit, ledger, and reports.'}
          </Typography>
        </Stack>

        <Stack component="form" spacing={2.25} onSubmit={handleSubmit}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(x) => setEmail(x.target.value)}
            autoComplete="email"
            fullWidth
            disabled={localLoading}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(x) => setPassword(x.target.value)}
            autoComplete="current-password"
            fullWidth
            disabled={localLoading}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
          />
          {(formError || error) && <Alert severity="error">{formError || error}</Alert>}
          <Button type="submit" variant="contained" size="large" disabled={localLoading || loading} sx={{ borderRadius: 1.5, py: 1.25 }}>
            {localLoading || loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
