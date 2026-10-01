import {
  alpha,
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { motion } from 'motion/react';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import OpacityOutlinedIcon from '@mui/icons-material/OpacityOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { Link as RouterLink } from 'react-router-dom';
import { HeroImage } from '@/components/ui/HeroImage';
import { MotionBox } from '@/components/motion/MotionBox';
import { StaggerChildren, StaggerItem } from '@/components/motion/StaggerChildren';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { MarketingBackground } from '@/components/marketing/MarketingBackground';
import { MarketingTopBar, marketingTopBarPad } from '@/components/marketing/MarketingTopBar';
import { ThemeModeToggle } from '@/components/ui/ThemeModeToggle';
import { PwaInstallButton } from '@/components/pwa/PwaInstallButton';
import { useStationAbout } from '@/context/StationAboutContext';
import { useThemeMode } from '@/context/ThemeModeContext';
import {
  marketingFontDisplay,
  marketingPageSx,
  marketingPalette,
  type MarketingPalette,
} from '@/theme/marketingTheme';

const steps = [
  { n: '01', title: 'Start shift', text: 'Open the pump day and assign nozzles.' },
  { n: '02', title: 'Reconcile', text: 'Close meters, cash, credit, and variance.' },
  { n: '03', title: 'Decide', text: 'Reports and dashboards for owners and managers.' },
] as const;

const modules = [
  {
    title: 'Shifts & meters',
    description: 'Nozzle readings and end-of-shift meter closure.',
    icon: SpeedOutlinedIcon,
    accent: '#22d3ee',
  },
  {
    title: 'Reconciliation',
    description: 'Cash, credit, and variance in one workflow.',
    icon: FactCheckOutlinedIcon,
    accent: '#0ea5e9',
  },
  {
    title: 'Fuel stock',
    description: 'Dips, tanks, purchases, and stock history.',
    icon: OpacityOutlinedIcon,
    accent: '#a78bfa',
  },
  {
    title: 'Credit',
    description: 'Party-wise sales, payments, and outstanding.',
    icon: CreditCardOutlinedIcon,
    accent: '#22d3ee',
  },
  {
    title: 'Ledger & cash',
    description: 'Cash book, expenses, and daily sheet.',
    icon: AccountBalanceWalletOutlinedIcon,
    accent: '#0ea5e9',
  },
  {
    title: 'Reports',
    description: 'Sales by fuel, collections, and shift performance.',
    icon: AssessmentOutlinedIcon,
    accent: '#a78bfa',
  },
] as const;

type ModuleItem = (typeof modules)[number];

function GlassCard({
  title,
  description,
  icon: Icon,
  accent,
  palette,
}: ModuleItem & { palette: MarketingPalette }) {
  const reduced = useReducedMotion();
  const Wrapper = reduced ? 'div' : motion.div;

  return (
    <Wrapper
      {...(!reduced && {
        whileHover: { y: -6, transition: { duration: 0.22 } },
      })}
      style={{ height: '100%' }}
    >
      <Box
        sx={{
          height: '100%',
          p: 2.5,
          borderRadius: 3,
          bgcolor: palette.glass,
          border: '1px solid',
          borderColor: palette.border,
          backdropFilter: 'blur(12px)',
          transition: 'box-shadow 0.25s, border-color 0.25s',
          '&:hover': {
            borderColor: alpha(accent, 0.45),
            boxShadow: `0 0 32px ${alpha(accent, 0.18)}`,
          },
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
            color: accent,
            bgcolor: alpha(accent, 0.12),
            boxShadow: `0 0 24px ${alpha(accent, 0.2)}`,
          }}
        >
          <Icon />
        </Box>
        <Typography
          sx={{
            fontFamily: marketingFontDisplay,
            fontWeight: 700,
            fontSize: '1.25rem',
            letterSpacing: '0.02em',
            color: palette.text,
            mb: 0.75,
          }}
        >
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: palette.textMuted, lineHeight: 1.65 }}>
          {description}
        </Typography>
      </Box>
    </Wrapper>
  );
}

function InViewGlassCard(props: ModuleItem & { palette: MarketingPalette }) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <GlassCard {...props} />;
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-48px' }}
      transition={{ duration: 0.45 }}
      style={{ height: '100%' }}
    >
      <GlassCard {...props} />
    </motion.div>
  );
}

export function LandingPage() {
  const reduced = useReducedMotion();
  const { resolvedMode } = useThemeMode();
  const { profile: station } = useStationAbout();
  const MARKETING = marketingPalette(resolvedMode);

  return (
    <Box
      sx={{
        ...marketingPageSx(),
        bgcolor: MARKETING.bg,
        color: MARKETING.text,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <MarketingBackground />
      <MarketingTopBar
        actions={
          <>
            <ThemeModeToggle marketing />
            <PwaInstallButton marketing />
            <Button
              component={RouterLink}
              to="/login"
              variant="contained"
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{
                borderRadius: 999,
                px: 2.5,
                fontWeight: 700,
                textTransform: 'none',
                bgcolor: MARKETING.cyan,
                color: MARKETING.bg,
                boxShadow: `0 0 28px ${alpha(MARKETING.cyan, 0.35)}`,
                '&:hover': {
                  bgcolor: MARKETING.blue,
                  boxShadow: `0 0 32px ${alpha(MARKETING.blue, 0.4)}`,
                },
              }}
            >
              Sign in
            </Button>
          </>
        }
      />

      <Box component="main" sx={{ flex: 1, position: 'relative', zIndex: 1, pt: marketingTopBarPad }}>
        <Container maxWidth="lg" sx={{ pt: { xs: 3, md: 5 }, pb: { xs: 6, md: 10 } }}>
          <Grid container spacing={{ xs: 4, md: 6 }} alignItems="center" sx={{ mb: { xs: 6, md: 9 } }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <StaggerChildren>
                <StaggerItem>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      px: 1.5,
                      py: 0.5,
                      mb: 2,
                      borderRadius: 999,
                      border: '1px solid',
                      borderColor: alpha(MARKETING.cyan, 0.35),
                      bgcolor: alpha(MARKETING.cyan, 0.08),
                      color: MARKETING.cyan,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {station.tagline}
                  </Box>
                </StaggerItem>
                <StaggerItem>
                  <Typography
                    component="h1"
                    sx={{
                      fontFamily: marketingFontDisplay,
                      fontWeight: 700,
                      fontSize: { xs: '2.5rem', sm: '3rem', md: '3.35rem' },
                      lineHeight: 1.05,
                      letterSpacing: '0.02em',
                      background: `linear-gradient(135deg, ${MARKETING.text} 0%, ${MARKETING.cyan} 45%, ${MARKETING.violet} 100%)`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    Run the pump floor with clarity
                  </Typography>
                </StaggerItem>
                <StaggerItem>
                  <Typography
                    sx={{
                      mt: 2,
                      maxWidth: 480,
                      color: MARKETING.textMuted,
                      fontSize: { xs: '1rem', md: '1.125rem' },
                      lineHeight: 1.7,
                    }}
                  >
                    Shifts, stock, credit, and cash — one modern workspace for workers, managers, and owners.
                  </Typography>
                </StaggerItem>
                <StaggerItem>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 3 }}>
                    <Button
                      component={RouterLink}
                      to="/login"
                      variant="contained"
                      size="large"
                      endIcon={<ArrowForwardRoundedIcon />}
                      sx={{
                        borderRadius: 999,
                        px: 3.5,
                        py: 1.25,
                        fontWeight: 700,
                        textTransform: 'none',
                        bgcolor: MARKETING.cyan,
                        color: MARKETING.bg,
                        boxShadow: `0 0 36px ${alpha(MARKETING.cyan, 0.35)}`,
                        '&:hover': { bgcolor: MARKETING.blue },
                      }}
                    >
                      Open {station.displayName}
                    </Button>
                  </Stack>
                </StaggerItem>
              </StaggerChildren>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <MotionBox preset="scaleIn">
                <Box
                  component={reduced ? 'div' : motion.div}
                  {...(!reduced && {
                    animate: { y: [0, -8, 0] },
                    transition: { duration: 5.5, repeat: Infinity, ease: 'easeInOut' },
                  })}
                  sx={{
                    position: 'relative',
                    borderRadius: 4,
                    p: '2px',
                    background: `linear-gradient(135deg, ${alpha(MARKETING.cyan, 0.6)}, ${alpha(MARKETING.violet, 0.4)})`,
                    boxShadow: `0 24px 64px ${alpha('#000', 0.45)}, 0 0 48px ${alpha(MARKETING.cyan, 0.15)}`,
                  }}
                >
                  <Box
                    sx={{
                      borderRadius: 3.5,
                      overflow: 'hidden',
                      aspectRatio: { xs: '16/10', md: '4/3' },
                      bgcolor: MARKETING.bgElevated,
                    }}
                  >
                    <HeroImage
                      webpSrc="/hero/hero-station.webp"
                      fallbackSvg="/hero/hero-station-fallback.svg"
                      alt=""
                    />
                  </Box>
                </Box>
              </MotionBox>
            </Grid>
          </Grid>

          <Box sx={{ mb: { xs: 5, md: 7 } }}>
            <Typography
              sx={{
                fontFamily: marketingFontDisplay,
                fontWeight: 700,
                fontSize: '1.5rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: MARKETING.textMuted,
                mb: 2.5,
              }}
            >
              How it flows
            </Typography>
            <Grid container spacing={2}>
              {steps.map((step, index) => (
                <Grid key={step.n} size={{ xs: 12, md: 4 }}>
                  <Box
                    component={reduced ? 'div' : motion.div}
                    {...(!reduced && {
                      initial: { opacity: 0, y: 20 },
                      whileInView: { opacity: 1, y: 0 },
                      viewport: { once: true, margin: '-40px' },
                      transition: { duration: 0.45, delay: index * 0.08 },
                    })}
                    sx={{
                      p: 2.5,
                      height: '100%',
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor: MARKETING.border,
                      bgcolor: MARKETING.glass,
                    }}
                  >
                    <Typography
                      sx={{
                        fontFamily: marketingFontDisplay,
                        fontWeight: 700,
                        fontSize: '2rem',
                        lineHeight: 1,
                        color: alpha(MARKETING.cyan, 0.85),
                        mb: 1,
                      }}
                    >
                      {step.n}
                    </Typography>
                    <Typography sx={{ fontWeight: 700, color: MARKETING.text, mb: 0.5 }}>{step.title}</Typography>
                    <Typography variant="body2" sx={{ color: MARKETING.textMuted, lineHeight: 1.6 }}>
                      {step.text}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>

          <Box>
            <Typography
              sx={{
                fontFamily: marketingFontDisplay,
                fontWeight: 700,
                fontSize: '1.5rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: MARKETING.textMuted,
                mb: 2.5,
              }}
            >
              Built for the forecourt
            </Typography>
            <Grid container spacing={2.5}>
              {modules.map((m) => (
                <Grid key={m.title} size={{ xs: 12, sm: 6, md: 4 }}>
                  <InViewGlassCard {...m} palette={MARKETING} />
                </Grid>
              ))}
            </Grid>
          </Box>
        </Container>
      </Box>

      <Box
        component="footer"
        sx={{
          position: 'relative',
          zIndex: 1,
          py: 2.5,
          borderTop: '1px solid',
          borderColor: MARKETING.border,
          textAlign: 'center',
        }}
      >
        <Typography variant="caption" sx={{ color: alpha(MARKETING.textMuted, 0.85), letterSpacing: '0.06em' }}>
          {station.displayName}
        </Typography>
      </Box>
    </Box>
  );
}
