import { useEffect, useState } from 'react';
import {
  alpha,
  Box,
  TextField,
  Typography,
  Alert,
  Stack,
  Chip,
  Link,
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
import { MotionButton } from '@/components/motion/MotionButton';
import { StaggerChildren, StaggerItem } from '@/components/motion/StaggerChildren';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { MarketingBackground } from '@/components/marketing/MarketingBackground';
import { PwaInstallButton } from '@/components/pwa/PwaInstallButton';
import { ThemeModeToggle } from '@/components/ui/ThemeModeToggle';
import { useStationAbout } from '@/context/StationAboutContext';
import { useThemeMode } from '@/context/ThemeModeContext';
import { marketingFieldSx, marketingFontDisplay, marketingPageSx, marketingPalette } from '@/theme/marketingTheme';

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
  const { resolvedMode } = useThemeMode();
  const palette = marketingPalette(resolvedMode);

  const chip = (
    <Chip
      label={label}
      clickable
      variant="outlined"
      onClick={onSelect}
      sx={{
        minHeight: 36,
        fontWeight: 600,
        borderColor: selected ? palette.cyan : palette.border,
        bgcolor: selected ? alpha(palette.cyan, 0.15) : 'transparent',
        color: selected ? palette.cyan : palette.textMuted,
        '&:hover': {
          borderColor: palette.cyan,
          bgcolor: alpha(palette.cyan, 0.1),
        },
      }}
    />
  );

  if (reduced) {
    return chip;
  }

  return (
    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} style={{ display: 'inline-block' }}>
      {chip}
    </motion.div>
  );
}

export function LoginPage() {
  const reduced = useReducedMotion();
  const { resolvedMode } = useThemeMode();
  const { profile: station } = useStationAbout();
  const MARKETING = marketingPalette(resolvedMode);
  const fieldSx = marketingFieldSx(MARKETING, resolvedMode);
  const { signIn, error, loading, profile } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  useEffect(() => {
    if (!profile) {
      return;
    }
    const target = from && from !== '/login' ? from : homePathForRole(profile.role);
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

  return (
    <Box
      sx={{
        ...marketingPageSx(),
        bgcolor: MARKETING.bg,
        color: MARKETING.text,
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        minHeight: '100dvh',
        position: 'relative',
      }}
    >
      <MarketingBackground />

      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          zIndex: 1,
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
            background: `linear-gradient(180deg, ${alpha(MARKETING.bg, 0.55)} 0%, ${alpha(MARKETING.bg, 0.92)} 100%)`,
          }}
        />
        <Box sx={{ position: 'relative', zIndex: 1, p: 5, mt: 'auto', maxWidth: 440 }}>
          <MotionBox preset="fadeUp">
            <StaggerChildren>
              <StaggerItem>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2,
                    bgcolor: alpha(MARKETING.cyan, 0.15),
                    border: '1px solid',
                    borderColor: alpha(MARKETING.cyan, 0.35),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 3,
                    color: MARKETING.cyan,
                  }}
                >
                  <LocalGasStationOutlinedIcon sx={{ fontSize: 32 }} />
                </Box>
              </StaggerItem>
              <StaggerItem>
                <Typography
                  sx={{
                    fontFamily: marketingFontDisplay,
                    fontWeight: 700,
                    fontSize: '2.5rem',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    lineHeight: 1.05,
                    mb: 1.5,
                  }}
                >
                  {station.displayName}
                </Typography>
              </StaggerItem>
              <StaggerItem>
                <Typography sx={{ color: MARKETING.textMuted, mb: 3, lineHeight: 1.7, maxWidth: 360 }}>
                  {station.tagline}
                </Typography>
              </StaggerItem>
              {BRAND_BULLETS.map((item) => (
                <StaggerItem key={item}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.1 }}>
                    <CheckCircleOutlineOutlinedIcon sx={{ fontSize: 20, color: MARKETING.cyan }} />
                    <Typography variant="body2" sx={{ color: MARKETING.text }}>
                      {item}
                    </Typography>
                  </Stack>
                </StaggerItem>
              ))}
            </StaggerChildren>
          </MotionBox>
        </Box>
      </Box>

      <MotionBox
        preset="fadeInRight"
        style={{ flex: 1, minWidth: 0, display: 'flex', zIndex: 1, position: 'relative' }}
      >
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: { xs: 2.5, sm: 4, md: 5 },
          }}
        >
          <Box
            component={reduced ? 'div' : motion.div}
            {...(!reduced && {
              initial: { opacity: 0, y: 16 },
              animate: { opacity: 1, y: 0 },
              transition: { duration: 0.5 },
            })}
            sx={{
              width: '100%',
              maxWidth: 440,
              p: { xs: 2.5, sm: 3.5 },
              borderRadius: 3,
              border: '1px solid',
              borderColor: MARKETING.border,
              bgcolor: MARKETING.glassStrong,
              backdropFilter: 'blur(16px)',
              boxShadow: `0 24px 64px ${alpha('#000', 0.35)}, 0 0 40px ${alpha(MARKETING.cyan, 0.06)}`,
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
                color: MARKETING.textMuted,
                '&:hover': { color: MARKETING.cyan },
              }}
            >
              <ArrowBackOutlinedIcon sx={{ fontSize: 16 }} />
              Back to home
            </Link>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  bgcolor: alpha(MARKETING.cyan, 0.12),
                  color: MARKETING.cyan,
                  display: { xs: 'flex', md: 'none' },
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LocalGasStationOutlinedIcon />
              </Box>
              <Typography
                sx={{
                  flex: 1,
                  fontFamily: marketingFontDisplay,
                  fontWeight: 700,
                  fontSize: '1.75rem',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Sign in
              </Typography>
              <ThemeModeToggle marketing />
              <PwaInstallButton marketing />
            </Stack>

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
                sx={fieldSx}
              />
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(x) => setPassword(x.target.value)}
                autoComplete="current-password"
                fullWidth
                disabled={isSigningIn}
                sx={fieldSx}
              />
              {(formError || error) && (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                  {formError || error}
                </Alert>
              )}
              <MotionButton
                type="submit"
                variant="contained"
                size="large"
                disabled={isSigningIn}
                sx={{
                  borderRadius: 999,
                  py: 1.35,
                  fontWeight: 700,
                  textTransform: 'none',
                  bgcolor: MARKETING.cyan,
                  color: MARKETING.bg,
                  boxShadow: `0 0 32px ${alpha(MARKETING.cyan, 0.35)}`,
                  '&:hover': { bgcolor: MARKETING.blue },
                  '&.Mui-disabled': {
                    bgcolor: alpha(MARKETING.cyan, 0.35),
                    color: alpha(MARKETING.bg, 0.7),
                  },
                }}
              >
                {isSigningIn ? 'Signing in…' : 'Sign in'}
              </MotionButton>
            </Stack>
          </Box>
        </Box>
      </MotionBox>
    </Box>
  );
}
