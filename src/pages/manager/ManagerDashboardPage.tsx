import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';

import { format, isSameDay } from 'date-fns';

import { LOCAL_DEMO } from '@/config/appMode';
import { demoResetStores } from '@/localDemo/demoBackend';
import { CashBankCollectionSummary } from '@/pages/manager/CashBankCollectionSummary';
import { TankStockDipSummary } from '@/pages/manager/TankStockDipSummary';
import { TodaySalesByShiftSection } from '@/pages/manager/TodaySalesByShiftSection';
import { TodayShiftStatusSection } from '@/pages/manager/TodayShiftStatusSection';
import { SalesByFuelChart } from '@/pages/manager/SalesByFuelChart';

function parseLocalYmd(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

function DashboardSection(props: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const { title, subtitle, children } = props;
  return (
    <Box component="section">
      <Stack spacing={0.5} sx={{ mb: 2 }}>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ fontWeight: 700, letterSpacing: '0.1em', lineHeight: 1.4 }}
        >
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Stack>
      {children}
    </Box>
  );
}

function QuickActions() {
  const actions = [
    { to: '/manager/fuel-stock/daily', label: 'Daily dip entry', icon: <EditOutlinedIcon fontSize="small" /> },
    { to: '/manager/credit', label: 'Credit', icon: <CreditCardOutlinedIcon fontSize="small" /> },
    { to: '/manager/reconciliations', label: 'Reconciliations', icon: <FactCheckOutlinedIcon fontSize="small" /> },
    { to: '/manager/reports', label: 'Reports', icon: <AssessmentOutlinedIcon fontSize="small" /> },
    { to: '/manager/daily-sheet', label: 'Daily sheet', icon: <PaymentsOutlinedIcon fontSize="small" /> },
  ] as const;

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {actions.map((a) => (
        <Button
          key={a.to}
          component={RouterLink}
          to={a.to}
          variant="outlined"
          size="small"
          startIcon={a.icon}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          {a.label}
        </Button>
      ))}
    </Stack>
  );
}

export function ManagerDashboardPage() {
  const theme = useTheme();

  const [reportIso, setReportIso] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const maxSelectableIso = format(new Date(), 'yyyy-MM-dd');
  const reportDay = useMemo(() => parseLocalYmd(reportIso), [reportIso]);
  const reportLabel = useMemo(
    () => (Number.isFinite(reportDay.getTime()) ? format(reportDay, 'dd MMM yyyy') : reportIso),
    [reportDay, reportIso],
  );
  const isSelectedToday = Number.isFinite(reportDay.getTime()) && isSameDay(reportDay, new Date());

  return (
    <Stack spacing={3.5} sx={{ pb: 4 }}>
      {/* Header */}
      <Box
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          background: (t) =>
            `linear-gradient(120deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 50%, ${t.palette.primary.light} 120%)`,
          color: 'primary.contrastText',
          p: { xs: 2.5, sm: 3 },
          boxShadow: (t) => `0 10px 32px ${alpha(t.palette.primary.main, 0.28)}`,
        }}
      >
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <GridViewOutlinedIcon sx={{ opacity: 0.95 }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  Manager dashboard
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.25 }}>
                  {reportLabel}
                  {isSelectedToday ? ' · Today' : ''}
                </Typography>
              </Box>
            </Stack>
            {isSelectedToday ? (
              <Chip
                label="Live"
                size="small"
                sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, bgcolor: alpha('#fff', 0.22), color: 'inherit', fontWeight: 700 }}
              />
            ) : null}
          </Stack>

          <Paper
            elevation={0}
            sx={{
              p: 1.75,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.12 : 0.98),
              color: 'text.primary',
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CalendarMonthOutlinedIcon sx={{ fontSize: 22, color: 'text.secondary', display: { xs: 'none', sm: 'block' } }} />
                <TextField
                  type="date"
                  label="Pump day"
                  value={reportIso}
                  onChange={(e) => setReportIso(e.target.value)}
                  size="small"
                  slotProps={{
                    htmlInput: { max: maxSelectableIso },
                    inputLabel: { shrink: true },
                  }}
                  sx={{ minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                All sections below follow this pump business day.
              </Typography>
            </Stack>
          </Paper>
        </Stack>
      </Box>

      {/* Quick actions */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.06em', display: 'block', mb: 1.25 }}>
          QUICK ACTIONS
        </Typography>
        <QuickActions />
      </Paper>

      {/* 1 — Shift sales */}
      <DashboardSection
        title="Shift performance"
        subtitle="Compare Shift 1 vs Shift 2 meter sales for the selected day."
      >
        <TodaySalesByShiftSection pumpDayIso={reportIso} reportLabel={reportLabel} />
      </DashboardSection>

      <DashboardSection
        title="Cash & bank collections"
        subtitle="Today's collections categorized by payment method."
      >
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <CashBankCollectionSummary pumpDayIso={reportIso} />
        </Paper>
      </DashboardSection>

      <DashboardSection
        title="Sales by fuel"
        subtitle="Revenue and volume split across MS, HSD, and XP from reconciled shifts."
      >
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <SalesByFuelChart pumpDayIso={reportIso} />
        </Paper>
      </DashboardSection>

      {/* Tank stock */}
      <DashboardSection title="Tank & inventory" subtitle="Dip readings, stock levels, and daily reconciliation.">
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <TankStockDipSummary />
        </Paper>
      </DashboardSection>

      <DashboardSection
        title="Shift activity"
        subtitle="Live shift status, attendants, and reconciliation progress."
      >
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <TodayShiftStatusSection pumpDayIso={reportIso} />
        </Paper>
      </DashboardSection>

      {LOCAL_DEMO ? (
        <Card
          elevation={0}
          sx={{
            borderRadius: 2,
            border: '2px dashed',
            borderColor: 'warning.light',
            bgcolor: (t) => alpha(t.palette.warning.main, 0.06),
          }}
        >
          <CardContent sx={{ pt: 2.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <RestartAltOutlinedIcon color="warning" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'warning.dark' }}>
                Local demo reset
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720, lineHeight: 1.7 }}>
              Clears shifts, readings, reconciliations, ledger, and credit in this browser, then restores starter setup.
            </Typography>
            <Button
              variant="contained"
              color="warning"
              startIcon={<RestartAltOutlinedIcon />}
              onClick={() => {
                if (!window.confirm('Reset all local demo data in this browser? This cannot be undone.')) return;
                demoResetStores();
                window.location.reload();
              }}
              sx={{ borderRadius: 2 }}
            >
              Reset to initial demo state
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
