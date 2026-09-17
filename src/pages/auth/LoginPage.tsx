import { useEffect, useState } from 'react';
import {
  alpha,
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Alert,
  Stack,
  Chip,
  Link,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { motion } from 'motion/react';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { requireEmail, requireNonEmpty } from '@/utils/validation';
import { LOCAL_DEMO } from '@/config/appMode';
import { homePathForRole } from '@/utils/roles';
import { HeroImage } from '@/components/ui/HeroImage';
import { MotionBox } from '@/components/motion/MotionBox';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@demo.local' },
  { label: 'Owner', email: 'owner@demo.local' },
  { label: 'Manager', email: 'manager@demo.local' },
  { label: 'Worker', email: 'operator@demo.local' },
] as const;

const BRAND_BULLETS = [
  'Shift & meter tracking',
  'End-of-shift reconciliation',
  'Credit, ledger & fuel stock',
  'Role-based dashboards',
] as const;

function DemoChip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <Chip
        label={label}
        clickable
        variant={selected ? 'filled' : 'outlined'}
        color={selected ? 'primary' : 'default'}
        onClick={onSelect}
        sx={{ minHeight: 36 }}
      />
    );
  }

  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} style={{ display: 'inline-block' }}>
      <Chip
        label={label}
        clickable
        variant={selected ? 'filled' : 'outlined'}
        color={selected ? 'primary' : 'default'}
        onClick={onSelect}
        sx={{ minHeight: 36 }}
      />
    </motion.div>
  );
}

export function LoginPage() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const reduced = useReducedMotion();
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
        : homePathForRole(profile.role);
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

  const isSigningIn = localLoading || loading;

  const brandPanel = (
    <Box
      sx={{
        display: { xs: 'none', md: 'flex' },
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'flex-end',
        position: 'relative',
        overflow: 'hidden',
        color: 'primary.contrastText',
      }}
    >
      <Box sx={{ position: 'absolute', inset: 0 }}>
        <HeroImage
          webpSrc="/hero/hero-dashboard.webp"
          fallbackSvg="/hero/hero-dashboard-fallback.svg"
          alt=""
        />
      </Box>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: (t) =>
            `linear-gradient(180deg, ${alpha(t.palette.primary.dark, 0.75)} 0%, ${alpha(t.palette.primary.main, 0.92)} 100%)`,
        }}
      />
      <Box sx={{ position: 'relative', p: 5, zIndex: 1 }}>
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 2,
            bgcolor: alpha('#fff', 0.15),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 3,
          }}
        >
          <LocalGasStationOutlinedIcon sx={{ fontSize: 32 }} />
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 1.5 }}>
          PumpStock
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.9, mb: 3, maxWidth: 360, lineHeight: 1.7 }}>
          Modern petrol pump operations — shifts, stock, credit, and reports in one dashboard.
        </Typography>
        <Stack spacing={1.25}>
          {BRAND_BULLETS.map((item) => (
            <Stack key={item} direction="row" spacing={1} alignItems="center">
              <CheckCircleOutlineOutlinedIcon sx={{ fontSize: 20, opacity: 0.9 }} />
              <Typography variant="body2" sx={{ opacity: 0.95 }}>
                {item}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
    </Box>
  );

  const formPanel = (
    <MotionBox preset="fadeInRight" style={{ flex: 1, minWidth: 0, display: 'flex' }}>
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2.5, sm: 4, md: 5 },
          bgcolor: 'background.default',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 420,
            p: { xs: 2.5, sm: 3.5 },
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: (t) => `0 16px 48px ${alpha(t.palette.common.black, 0.08)}`,
          }}
        >
          <Link
            component={RouterLink}
            to="/"
            underline="hover"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              mb: 2,
              typography: 'body2',
              color: 'text.secondary',
            }}
          >
            <ArrowBackOutlinedIcon sx={{ fontSize: 16 }} />
            Back to home
          </Link>

          {!isDesktop ? (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                  color: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LocalGasStationOutlinedIcon />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Sign in
              </Typography>
            </Stack>
          ) : (
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
              Sign in
            </Typography>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, lineHeight: 1.6 }}>
            {LOCAL_DEMO
              ? 'Demo mode — pick a role below or enter credentials. Any password works.'
              : 'Sign in with your work credentials to manage shifts, credit, ledger, and reports.'}
          </Typography>

          {LOCAL_DEMO ? (
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
              {DEMO_ACCOUNTS.map((acc) => (
                <DemoChip
                  key={acc.email}
                  label={acc.label}
                  selected={email === acc.email}
                  onSelect={() => setEmail(acc.email)}
                />
              ))}
            </Stack>
          ) : null}

          <Stack component="form" spacing={2.25} onSubmit={handleSubmit}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(x) => setEmail(x.target.value)}
              autoComplete="email"
              fullWidth
              disabled={isSigningIn}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(x) => setPassword(x.target.value)}
              autoComplete="current-password"
              fullWidth
              disabled={isSigningIn}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
            {(formError || error) && <Alert severity="error">{formError || error}</Alert>}
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isSigningIn}
              sx={{
                borderRadius: 1.5,
                py: 1.25,
                ...(isSigningIn &&
                  !reduced && {
                    animation: 'signInPulse 1.5s ease-in-out infinite',
                    '@keyframes signInPulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.85 },
                    },
                  }),
              }}
            >
              {isSigningIn ? 'Signing in…' : 'Sign in'}
            </Button>
          </Stack>
        </Paper>
      </Box>
    </MotionBox>
  );

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, overflowX: 'hidden' }}>
      {brandPanel}
      {formPanel}
    </Box>
  );
}
