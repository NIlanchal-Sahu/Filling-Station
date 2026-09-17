import {
  alpha,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { motion } from 'motion/react';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import OpacityOutlinedIcon from '@mui/icons-material/OpacityOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { LOCAL_DEMO } from '@/config/appMode';
import { HeroImage } from '@/components/ui/HeroImage';
import { MotionBox } from '@/components/motion/MotionBox';
import { StaggerChildren, StaggerItem } from '@/components/motion/StaggerChildren';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const features = [
  {
    title: 'Shifts & meters',
    description: 'Start shifts, record nozzle readings, and close meters with confidence.',
    icon: SpeedOutlinedIcon,
  },
  {
    title: 'Reconciliation',
    description: 'End-of-shift cash, credit, and variance reconciliation in one flow.',
    icon: FactCheckOutlinedIcon,
  },
  {
    title: 'Fuel stock',
    description: 'Daily dip entries, tank calibration, purchases, and stock history.',
    icon: OpacityOutlinedIcon,
  },
  {
    title: 'Credit customers',
    description: 'Track credit sales, payments, and party-wise outstanding balances.',
    icon: CreditCardOutlinedIcon,
  },
  {
    title: 'Ledger & cash',
    description: 'Cash book, expenses, and daily sheet for complete financial visibility.',
    icon: AccountBalanceWalletOutlinedIcon,
  },
  {
    title: 'Reports',
    description: 'Collections, sales by fuel, and manager dashboards for quick decisions.',
    icon: AssessmentOutlinedIcon,
  },
] as const;

const howItWorks = [
  {
    step: '1',
    title: 'Start shift',
    description: 'Workers open a shift and select nozzles for the pump day.',
    icon: PlayCircleOutlineOutlinedIcon,
  },
  {
    step: '2',
    title: 'Reconcile',
    description: 'Close meters, record cash and credit, and submit for review.',
    icon: CheckCircleOutlineOutlinedIcon,
  },
  {
    step: '3',
    title: 'Reports',
    description: 'Managers and owners view sales, stock, and collections instantly.',
    icon: BarChartOutlinedIcon,
  },
] as const;

function FeatureCard({ title, description, icon: Icon }: FeatureItem) {
  const reduced = useReducedMotion();
  const CardMotion = reduced ? 'div' : motion.div;

  return (
    <CardMotion
      {...(!reduced && {
        whileHover: { y: -4, transition: { duration: 0.2 } },
      })}
      style={{ height: '100%' }}
    >
      <Card
        elevation={0}
        sx={{
          height: '100%',
          border: '1px solid',
          borderColor: 'divider',
          transition: 'box-shadow 0.25s',
          '&:hover': {
            boxShadow: (t) => `0 12px 32px ${alpha(t.palette.primary.main, 0.12)}`,
          },
        }}
      >
        <CardContent sx={{ p: 2.5 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 1.5,
            }}
          >
            <Icon />
          </Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.75 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {description}
          </Typography>
        </CardContent>
      </Card>
    </CardMotion>
  );
}

type FeatureItem = {
  title: string;
  description: string;
  icon: (typeof features)[number]['icon'];
};

function InViewFeatureCard(props: FeatureItem) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <FeatureCard {...props} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4 }}
      style={{ height: '100%' }}
    >
      <FeatureCard {...props} />
    </motion.div>
  );
}

export function LandingPage() {
  const reduced = useReducedMotion();

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <MotionBox preset="fadeDown">
        <AppBar
          position="sticky"
          elevation={0}
          sx={{ bgcolor: 'background.paper', color: 'text.primary', borderBottom: 1, borderColor: 'divider' }}
        >
          <Toolbar>
            <LocalGasStationOutlinedIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 800 }}>
              PumpStock
            </Typography>
            <Button component={RouterLink} to="/login" variant="contained">
              Sign in
            </Button>
          </Toolbar>
        </AppBar>
      </MotionBox>

      <Box
        sx={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          background: (t) =>
            `linear-gradient(165deg, ${alpha(t.palette.primary.main, 0.1)} 0%, ${t.palette.background.default} 45%, ${alpha(t.palette.primary.light, 0.06)} 100%)`,
          '&::before': reduced
            ? undefined
            : {
                content: '""',
                position: 'absolute',
                inset: '-20%',
                background: (t) =>
                  `radial-gradient(ellipse at 20% 30%, ${alpha(t.palette.primary.main, 0.15)} 0%, transparent 50%),
                   radial-gradient(ellipse at 80% 70%, ${alpha(t.palette.primary.light, 0.12)} 0%, transparent 50%)`,
                animation: 'heroMesh 18s ease-in-out infinite alternate',
                pointerEvents: 'none',
                '@keyframes heroMesh': {
                  '0%': { transform: 'translate(0, 0) scale(1)' },
                  '100%': { transform: 'translate(2%, -2%) scale(1.05)' },
                },
              },
        }}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 }, minWidth: 0, position: 'relative' }}>
          <Grid container spacing={4} alignItems="center" sx={{ mb: { xs: 5, md: 7 } }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <StaggerChildren>
                <StaggerItem>
                  <Typography variant="overline" color="primary" sx={{ fontWeight: 700, letterSpacing: '0.12em' }}>
                    Petrol pump operations
                  </Typography>
                </StaggerItem>
                <StaggerItem>
                  <Typography
                    variant="h3"
                    component="h1"
                    sx={{ fontWeight: 800, letterSpacing: '-0.03em', fontSize: { xs: '2rem', md: '2.75rem' }, mt: 1 }}
                  >
                    Shifts, stock, credit & reports — in one place
                  </Typography>
                </StaggerItem>
                <StaggerItem>
                  <Typography
                    variant="h6"
                    color="text.secondary"
                    sx={{ fontWeight: 400, lineHeight: 1.6, fontSize: { xs: '1rem', md: '1.15rem' }, mt: 2 }}
                  >
                    PumpStock helps filling stations manage meter readings, end-of-shift reconciliation, credit
                    customers, cash ledger, and fuel stock with a modern dashboard experience.
                  </Typography>
                </StaggerItem>
                <StaggerItem>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 2 }}>
                    <Button component={RouterLink} to="/login" variant="contained" size="large" sx={{ px: 3 }}>
                      Sign in to PumpStock
                    </Button>
                  </Stack>
                </StaggerItem>
              </StaggerChildren>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <MotionBox preset="scaleIn">
                <Box
                  sx={{
                    borderRadius: 2,
                    overflow: 'hidden',
                    boxShadow: (t) => `0 24px 48px ${alpha(t.palette.common.black, 0.12)}`,
                    aspectRatio: { xs: '16/10', md: '4/3' },
                    maxHeight: { md: 420 },
                  }}
                >
                  <HeroImage
                    webpSrc="/hero/hero-station.webp"
                    fallbackSvg="/hero/hero-station-fallback.svg"
                    alt=""
                  />
                </Box>
              </MotionBox>
            </Grid>
          </Grid>

          <Box sx={{ mb: { xs: 5, md: 6 } }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.1em' }}>
              How it works
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1.5 }}>
              {howItWorks.map((step) => {
                const Icon = step.icon;
                return (
                  <Grid key={step.title} size={{ xs: 12, sm: 4 }}>
                    <InViewFeatureCard
                      title={step.title}
                      description={step.description}
                      icon={Icon}
                    />
                  </Grid>
                );
              })}
            </Grid>
          </Box>

          <Grid container spacing={2.5}>
            {features.map((f) => (
              <Grid key={f.title} size={{ xs: 12, sm: 6, md: 4 }}>
                <InViewFeatureCard {...f} />
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <MotionBox preset="fade">
        <Box component="footer" sx={{ py: 3, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Container maxWidth="lg">
            {LOCAL_DEMO ? (
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                <strong>Demo mode:</strong> sign in with <code>admin@demo.local</code>, <code>owner@demo.local</code>,{' '}
                <code>manager@demo.local</code>, or <code>operator@demo.local</code> — any password. Data stays in this
                browser.
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                PumpStock — filling station management for managers, workers, and owners.
              </Typography>
            )}
          </Container>
        </Box>
      </MotionBox>
    </Box>
  );
}
