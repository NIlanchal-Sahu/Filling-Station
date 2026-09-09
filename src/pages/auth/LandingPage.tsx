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
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import OpacityOutlinedIcon from '@mui/icons-material/OpacityOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { LOCAL_DEMO } from '@/config/appMode';

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

export function LandingPage() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'background.paper', color: 'text.primary', borderBottom: 1, borderColor: 'divider' }}>
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

      <Box
        sx={{
          flex: 1,
          background: (t) =>
            `linear-gradient(165deg, ${alpha(t.palette.primary.main, 0.1)} 0%, ${t.palette.background.default} 45%, ${alpha(t.palette.primary.light, 0.06)} 100%)`,
        }}
      >
        <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 }, minWidth: 0 }}>
          <Stack spacing={2} sx={{ mb: { xs: 4, md: 6 }, maxWidth: 720 }}>
            <Typography variant="overline" color="primary" sx={{ fontWeight: 700, letterSpacing: '0.12em' }}>
              Petrol pump operations
            </Typography>
            <Typography variant="h3" component="h1" sx={{ fontWeight: 800, letterSpacing: '-0.03em', fontSize: { xs: '2rem', md: '2.75rem' } }}>
              Shifts, stock, credit & reports — in one place
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400, lineHeight: 1.6, fontSize: { xs: '1rem', md: '1.15rem' } }}>
              PumpStock helps filling stations manage meter readings, end-of-shift reconciliation, credit customers, cash ledger, and fuel stock with a modern dashboard experience.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1 }}>
              <Button component={RouterLink} to="/login" variant="contained" size="large" sx={{ px: 3 }}>
                Sign in to PumpStock
              </Button>
            </Stack>
          </Stack>

          <Grid container spacing={2.5}>
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <Grid key={f.title} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card
                    elevation={0}
                    sx={{
                      height: '100%',
                      border: '1px solid',
                      borderColor: 'divider',
                      transition: 'box-shadow 0.2s, transform 0.2s',
                      '&:hover': {
                        boxShadow: (t) => `0 12px 32px ${alpha(t.palette.primary.main, 0.12)}`,
                        transform: 'translateY(-2px)',
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
                        {f.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        {f.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Container>
      </Box>

      <Box component="footer" sx={{ py: 3, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          {LOCAL_DEMO ? (
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
              <strong>Demo mode:</strong> sign in with{' '}
              <code>admin@demo.local</code>, <code>owner@demo.local</code>, <code>manager@demo.local</code>, or{' '}
              <code>operator@demo.local</code> — any password. Data stays in this browser.
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              PumpStock — filling station management for managers, workers, and owners.
            </Typography>
          )}
        </Container>
      </Box>
    </Box>
  );
}
