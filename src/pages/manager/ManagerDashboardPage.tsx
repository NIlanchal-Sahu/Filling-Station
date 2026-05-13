import { useEffect, useMemo, useState } from 'react';

import {
  alpha,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import DirectionsCarFilledOutlinedIcon from '@mui/icons-material/DirectionsCarFilledOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import WalletOutlinedIcon from '@mui/icons-material/WalletOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';

import type { Theme } from '@mui/material/styles';
import { format, isSameDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';

import { LOCAL_DEMO } from '@/config/appMode';
import { demoResetStores } from '@/localDemo/demoBackend';
import {
  getTodaySalesByFuelType,
  getTodayReconciliationPaymentTotals,
  getTotalOutstandingCredit,
  type FuelTotals,
  type TodayReconciliationPaymentTotals,
} from '@/services/aggregatesService';

/** Local midnight for yyyy-MM-dd. */
function parseLocalYmd(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

function fuelDotColor(fuelName: string, theme: Theme): string {
  const u = fuelName.toUpperCase();
  if (u.includes('DIESEL')) return theme.palette.info.main;
  if (u.includes('XP')) return theme.palette.warning.main;
  if (u.includes('PETROL')) return theme.palette.error.light;
  return theme.palette.success.main;
}

function KpiCard(props: {
  title: string;
  value: string;
  caption?: string;
  icon: React.ReactNode;
  accent: string;
}) {
  const { title, value, caption, icon, accent } = props;
  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        '&:hover': {
          boxShadow: (t) => `0 8px 24px ${alpha(t.palette.common.black, 0.08)}`,
        },
      }}
    >
      <Box sx={{ height: 3, bgcolor: accent }} />
      <CardContent sx={{ pt: 2.5, pb: 2, px: 2.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start" justifyContent="space-between">
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ letterSpacing: '0.06em', fontWeight: 600, lineHeight: 1.4 }}
            >
              {title}
            </Typography>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                mt: 0.75,
                fontVariantNumeric: 'tabular-nums',
                fontSize: { xs: '1.25rem', sm: '1.5rem' },
                wordBreak: 'break-word',
              }}
            >
              {value}
            </Typography>
            {caption ? (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1.25, display: 'block', lineHeight: 1.5 }}>
                {caption}
              </Typography>
            ) : null}
          </Box>
          <Box
            sx={{
              flexShrink: 0,
              p: 1.25,
              borderRadius: 2,
              bgcolor: (t) => alpha(accent, t.palette.mode === 'dark' ? 0.2 : 0.12),
              color: accent,
              display: 'flex',
            }}
          >
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function ManagerDashboardPage() {
  const theme = useTheme();
  const nav = useNavigate();

  const [reportIso, setReportIso] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [sales, setSales] = useState<FuelTotals[]>([]);
  const [reconPay, setReconPay] = useState<TodayReconciliationPaymentTotals | null>(null);
  const [credit, setCredit] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const maxSelectableIso = format(new Date(), 'yyyy-MM-dd');

  const reportDay = useMemo(() => parseLocalYmd(reportIso), [reportIso]);
  const reportLabel = useMemo(
    () => (Number.isFinite(reportDay.getTime()) ? format(reportDay, 'dd MMM yyyy') : reportIso),
    [reportDay, reportIso],
  );
  const isSelectedToday = Number.isFinite(reportDay.getTime()) && isSameDay(reportDay, new Date());

  useEffect(() => {
    let ok = true;

    const dayCandidate = parseLocalYmd(reportIso);
    const dayAnchor = Number.isFinite(dayCandidate.getTime()) ? dayCandidate : new Date();

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [s, rp, cr] = await Promise.all([
          getTodaySalesByFuelType(dayAnchor),
          getTodayReconciliationPaymentTotals(dayAnchor),
          getTotalOutstandingCredit(),
        ]);

        if (ok) {
          setSales(s);
          setReconPay(rp);
          setCredit(cr);
        }
      } catch (e) {
        if (ok) {
          setErr(e instanceof Error ? e.message : 'Failed to load dashboard');
        }
      } finally {
        if (ok) {
          setLoading(false);
        }
      }
    })();

    return () => {
      ok = false;
    };
  }, [reportIso]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          py: 14,
          px: 2,
        }}
      >
        <CircularProgress size={40} thickness={4} />
        <Typography color="text.secondary" variant="body1">
          Loading dashboard…
        </Typography>
      </Box>
    );
  }

  const emptySalesCopy = `No closed shifts ending on ${reportLabel}.`;

  const cashVal = reconPay != null ? `₹ ${reconPay.cash.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  const paytmVal =
    reconPay != null
      ? `₹ ${reconPay.paytmOnline.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '—';
  const iciciVal =
    reconPay != null
      ? `₹ ${reconPay.iciciCard.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '—';
  const fleetVal =
    reconPay != null
      ? `₹ ${reconPay.fleetCard.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '—';
  const creditVal =
    credit != null ? `₹ ${credit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

  return (
    <Stack spacing={3} sx={{ pb: 4 }}>
      <Box
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          background: (t) =>
            `linear-gradient(120deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 48%, ${t.palette.primary.light} 120%)`,
          color: 'primary.contrastText',
          p: { xs: 2.5, sm: 3 },
          boxShadow: (t) => `0 12px 40px ${alpha(t.palette.primary.main, 0.35)}`,
        }}
      >
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'flex-start' }}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <GridViewOutlinedIcon sx={{ opacity: 0.95 }} />
                <Typography variant="overline" sx={{ opacity: 0.9, letterSpacing: '0.12em', fontWeight: 600 }}>
                  Home
                </Typography>
              </Stack>
              <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                Manager dashboard
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.92, mt: 0.75, maxWidth: 560 }}>
                Sales — by fuel — and reconciliation payment KPIs for your selected pump day. The attendant{' '}
                <strong>roster</strong> (who worked which shift) is under <strong>Reports</strong>, tab{' '}
                <strong>Pump boys / girls</strong>. Outstanding credit is a rolling total across all shifts.
              </Typography>
            </Box>
            {isSelectedToday ? (
              <Chip label="Today" size="small" sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, bgcolor: alpha('#fff', 0.22), color: 'inherit', fontWeight: 600 }} />
            ) : null}
          </Stack>

          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.12 : 0.98),
              color: 'text.primary',
              border: '1px solid',
              borderColor: alpha('#fff', 0.35),
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} flexWrap="wrap">
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                <CalendarMonthOutlinedIcon sx={{ fontSize: 22, color: 'text.secondary', display: { xs: 'none', sm: 'inline-flex' } }} />
                <TextField
                  type="date"
                  label="Report date"
                  value={reportIso}
                  onChange={(e) => setReportIso(e.target.value)}
                  size="small"
                  sx={{
                    minWidth: 200,
                    width: { xs: '100%', sm: 'auto' },
                    '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
                  }}
                  slotProps={{
                    htmlInput: { max: maxSelectableIso },
                    inputLabel: { shrink: true },
                  }}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: { sm: 200 } }}>
                Figures below are for <strong>{reportLabel}</strong>
                {isSelectedToday ? ' (today).' : '.'} Change the date to review another closing day.
              </Typography>
            </Stack>
          </Paper>
        </Stack>
      </Box>

      {err && <Alert severity="error">{err}</Alert>}

      <Stack spacing={3}>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: '1.6fr 1fr' },
          alignItems: 'stretch',
        }}
      >
        <Card
          elevation={0}
          sx={{
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ px: 2.5, pt: 2.5, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <LocalGasStationOutlinedIcon color="primary" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Sales by fuel — {reportLabel}
            </Typography>
          </Box>
          <Divider />
          <CardContent sx={{ pt: 2, pb: 2.5 }}>
            {sales.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {emptySalesCopy}
              </Typography>
            ) : (
              <Stack spacing={0}>
                {sales.map((r, i) => (
                  <Box key={r.fuelTypeName}>
                    {i > 0 ? <Divider sx={{ my: 1.5 }} /> : null}
                    <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                        <Box
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: fuelDotColor(r.fuelTypeName, theme),
                            flexShrink: 0,
                          }}
                        />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {r.fuelTypeName}
                        </Typography>
                      </Stack>
                      <Stack alignItems="flex-end" spacing={0.25} sx={{ textAlign: 'right' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {r.liters.toFixed(2)} L
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '1.1rem' }}>
                          ₹ {r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        <KpiCard
          title="Credit outstanding"
          value={creditVal}
          caption="Running balance across all credit customers."
          accent={theme.palette.secondary.main}
          icon={<CreditCardOutlinedIcon />}
        />
      </Box>

      <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Reconciliation totals — {reportLabel}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
        }}
      >
        <KpiCard
          title={`Cash`}
          value={cashVal}
          caption="Declared cash in reconciliations for this date."
          accent={theme.palette.success.main}
          icon={<PaymentsOutlinedIcon />}
        />
        <KpiCard
          title={`Paytm / online`}
          value={paytmVal}
          caption="Declared Paytm / UPI-style channels for this date."
          accent={theme.palette.info.main}
          icon={<WalletOutlinedIcon />}
        />
        <KpiCard
          title={`ICICI / card`}
          value={iciciVal}
          caption="Declared card totals for this date."
          accent={theme.palette.primary.main}
          icon={<CreditCardOutlinedIcon />}
        />
        <KpiCard
          title={`Fleet card`}
          value={fleetVal}
          caption="Declared fleet card totals for this date."
          accent={theme.palette.warning.main}
          icon={<DirectionsCarFilledOutlinedIcon />}
        />
      </Box>

      <Box>
        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', mb: 1.5 }}>
          Shortcuts
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
          <Button variant="contained" size="large" startIcon={<PlaylistAddOutlinedIcon />} onClick={() => nav('/shifts/new')} sx={{ borderRadius: 2, px: 2.5, py: 1.25 }}>
            Start new shift
          </Button>
          <Button variant="outlined" size="large" startIcon={<RequestQuoteOutlinedIcon />} onClick={() => nav('/manager/ledger')} sx={{ borderRadius: 2, px: 2.25 }}>
            Ledger
          </Button>
          <Button variant="outlined" size="large" startIcon={<AssessmentOutlinedIcon />} onClick={() => nav('/manager/reports')} sx={{ borderRadius: 2 }}>
            Reports
          </Button>
          <Button variant="outlined" size="large" startIcon={<FactCheckOutlinedIcon />} onClick={() => nav('/manager/reconciliations')} sx={{ borderRadius: 2 }}>
            Reconciliations
          </Button>
          <Button variant="outlined" size="large" startIcon={<TableChartOutlinedIcon />} onClick={() => nav('/manager/daily-sheet')} sx={{ borderRadius: 2 }}>
            Daily sheet
          </Button>
        </Stack>
      </Box>

      {LOCAL_DEMO && (
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
              Clears shifts, readings, reconciliations, ledger, and credit transactions in this browser, then restores the
              starter setup (demo users, fuels, nozzles, one sample credit customer at ₹0).
            </Typography>
            <Button
              variant="contained"
              color="warning"
              startIcon={<RestartAltOutlinedIcon />}
              onClick={() => {
                if (
                  !window.confirm(
                    'Reset all local demo data in this browser? This cannot be undone.',
                  )
                ) {
                  return;
                }
                demoResetStores();
                window.location.reload();
              }}
              sx={{ borderRadius: 2 }}
            >
              Reset to initial demo state
            </Button>
          </CardContent>
        </Card>
      )}
      </Stack>
    </Stack>
  );
}
