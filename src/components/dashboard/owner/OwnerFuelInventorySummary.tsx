import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Grid from '@mui/material/Grid2';
import {
  alpha,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
  useTheme,
} from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import PropaneTankOutlinedIcon from '@mui/icons-material/PropaneTankOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { format, parseISO } from 'date-fns';
import { getFuelStockOverview } from '@/services/fuelStockService';
import type { FuelStockOverview } from '@/types/entities';
import {
  getPumpDayOpeningVariationByFuel,
  type PumpDayOpeningVariationRow,
} from '@/services/pumpDayDipVariationService';
import { FUEL_STOCK_UPDATED_EVENT, fuelStockHealthColor } from '@/utils/fuelStockDisplay';
import { PumpDayPicker } from '@/components/ui/PumpDayPicker';
import {
  collectFuelVariationAlerts,
  formatPumpDayVariationLiters,
  dailyDipEntryPath,
  dailyDipReportPath,
  FUEL_VARIATION_TAB_CODES,
  isPumpDayVariationAlert,
  pumpDayVariationLiters,
  type FuelVariationTabCode,
} from '@/components/dashboard/owner/ownerFuelVariation';

type Props = {
  pumpDayIso: string;
  maxSelectableIso: string;
};

function VariationFuelColumn(props: {
  code: FuelVariationTabCode;
  variationRows: PumpDayOpeningVariationRow[];
  to: string;
}) {
  const { code, variationRows, to } = props;
  const liters = pumpDayVariationLiters(variationRows, code);
  const alert = isPumpDayVariationAlert(variationRows, code);

  return (
    <Box
      component={RouterLink}
      to={to}
      sx={{
        display: 'block',
        textAlign: 'center',
        py: 1.25,
        px: 0.5,
        borderRadius: 2,
        cursor: 'pointer',
        textDecoration: 'none',
        color: 'inherit',
        border: '1px solid',
        borderColor: alert
          ? (t) => alpha(t.palette.warning.main, 0.45)
          : 'divider',
        bgcolor: alert
          ? (t) => alpha(t.palette.warning.main, t.palette.mode === 'dark' ? 0.1 : 0.05)
          : 'transparent',
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
        },
      }}
    >
      <Typography
        variant="body2"
        sx={{
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          fontSize: '0.88rem',
          color: alert ? 'warning.dark' : 'text.primary',
        }}
      >
        {formatPumpDayVariationLiters(liters)}
      </Typography>
    </Box>
  );
}

export function OwnerFuelInventorySummary({ pumpDayIso, maxSelectableIso }: Props) {
  const theme = useTheme();
  const [overview, setOverview] = useState<FuelStockOverview | null>(null);
  const [variationIso, setVariationIso] = useState(pumpDayIso);
  const [variationRows, setVariationRows] = useState<PumpDayOpeningVariationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [variationLoading, setVariationLoading] = useState(false);
  useEffect(() => {
    setVariationIso(pumpDayIso);
  }, [pumpDayIso]);

  const variationLabel = useMemo(() => {
    const d = parseISO(`${variationIso}T12:00:00`);
    return Number.isFinite(d.getTime()) ? format(d, 'dd MMM yyyy') : variationIso;
  }, [variationIso]);

  const loadOverview = useCallback(async () => {
    return getFuelStockOverview();
  }, []);

  const loadVariationRows = useCallback(async (iso: string) => {
    return getPumpDayOpeningVariationByFuel(iso);
  }, []);

  useEffect(() => {
    let ok = true;
    setLoading(true);
    void loadOverview()
      .then((o) => {
        if (!ok) return;
        setOverview(o);
      })
      .finally(() => {
        if (ok) setLoading(false);
      });
    return () => {
      ok = false;
    };
  }, [loadOverview]);

  useEffect(() => {
    let ok = true;
    setVariationLoading(true);
    void loadVariationRows(variationIso)
      .then((rows) => {
        if (!ok) return;
        setVariationRows(rows);
      })
      .finally(() => {
        if (ok) setVariationLoading(false);
      });
    return () => {
      ok = false;
    };
  }, [variationIso, loadVariationRows]);

  useEffect(() => {
    const refresh = () => {
      void loadOverview().then(setOverview);
      void loadVariationRows(variationIso).then(setVariationRows);
    };
    window.addEventListener(FUEL_STOCK_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(FUEL_STOCK_UPDATED_EVENT, refresh);
  }, [loadOverview, loadVariationRows, variationIso]);

  const variationAlerts = useMemo(() => collectFuelVariationAlerts(variationRows), [variationRows]);

  const lastDipTime = useMemo(() => {
    if (!overview?.items.length) return null;
    let latest: number | undefined;
    for (const item of overview.items) {
      const ms = item.lastDipAt ? item.lastDipAt.toMillis() : undefined;
      if (ms && (!latest || ms > latest)) latest = ms;
    }
    return latest ? format(new Date(latest), 'hh:mm a') : null;
  }, [overview]);

  if (loading) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 3.5,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          minHeight: 180,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <CircularProgress size={24} />
      </Paper>
    );
  }

  const variationBlock = (
    <Box
      sx={{
        mt: 1.5,
        p: 1.25,
        borderRadius: 2,
        border: '1px solid',
        borderColor: (t) =>
          variationAlerts.length > 0
            ? alpha(t.palette.warning.main, 0.45)
            : 'divider',
        bgcolor: (t) =>
          variationAlerts.length > 0
            ? alpha(t.palette.warning.main, t.palette.mode === 'dark' ? 0.12 : 0.06)
            : t.palette.mode === 'dark'
              ? alpha(t.palette.common.white, 0.04)
              : '#f8fafc',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: 1, minWidth: 0, flexWrap: 'wrap', rowGap: 1 }}
      >
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <WarningAmberIcon
            sx={{
              fontSize: 18,
              color: variationAlerts.length > 0 ? 'warning.main' : 'text.secondary',
            }}
          />
          <Typography
            variant="caption"
            sx={{
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: variationAlerts.length > 0 ? 'warning.dark' : 'text.secondary',
              fontSize: '0.72rem',
            }}
          >
            Fuel variation
          </Typography>
        </Stack>
        <PumpDayPicker
          compact
          hideCaption
          label={variationLabel}
          dateIso={variationIso}
          maxIso={maxSelectableIso}
          onDateIsoChange={setVariationIso}
        />
      </Stack>

      <Tabs
        value={false}
        variant="fullWidth"
        sx={{
          minHeight: 36,
          mb: 1,
          '& .MuiTab-root': {
            minHeight: 36,
            py: 0.5,
            fontWeight: 800,
            fontSize: '0.8rem',
            textTransform: 'none',
          },
        }}
      >
        {FUEL_VARIATION_TAB_CODES.map((code) => (
          <Tab
            key={code}
            component={RouterLink}
            to={dailyDipEntryPath(variationIso, code)}
            value={code}
            label={code}
            sx={{
              color: isPumpDayVariationAlert(variationRows, code) ? 'warning.dark' : undefined,
            }}
          />
        ))}
      </Tabs>

      {variationLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
          <CircularProgress size={20} />
        </Box>
      ) : (
        <>
          <Grid container spacing={1}>
            {FUEL_VARIATION_TAB_CODES.map((code) => (
              <Grid key={code} size={4}>
                <VariationFuelColumn
                  code={code}
                  variationRows={variationRows}
                  to={dailyDipEntryPath(variationIso, code)}
                />
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </Box>
  );

  if (!overview?.hasData) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.25 },
          borderRadius: 3.5,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          boxShadow: (t) =>
            t.palette.mode === 'dark' ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.03)',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography
            variant="caption"
            sx={{
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'text.secondary',
              fontSize: '0.68rem',
            }}
          >
            FUEL & INVENTORY
          </Typography>
          <PropaneTankOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
        </Stack>

        <Box
          sx={{
            my: 2,
            py: 2,
            px: 1.5,
            borderRadius: 2,
            bgcolor: (t) =>
              t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.04) : '#f8fafc',
            border: '1px solid',
            borderColor: 'divider',
            textAlign: 'center',
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
            No tank dip readings recorded yet.
          </Typography>
        </Box>

        {variationBlock}

        <Box sx={{ pt: 1, mt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button
            component={RouterLink}
            to={dailyDipReportPath(variationIso)}
            size="small"
            endIcon={<ArrowForwardOutlinedIcon sx={{ fontSize: 16 }} />}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.82rem',
              p: 0,
              color: 'primary.main',
            }}
          >
            Daily Dip Report
          </Button>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.25 },
        borderRadius: 3.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: (t) =>
          t.palette.mode === 'dark' ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
      }}
    >
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'text.secondary',
              fontSize: '0.68rem',
            }}
          >
            FUEL & INVENTORY
          </Typography>
          <PropaneTankOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
        </Stack>

        <Stack spacing={1.5}>
          {overview.items.map((item) => {
            const healthColor = fuelStockHealthColor(item.health, theme);
            const liters = Math.round(item.currentStockLiters).toLocaleString('en-IN');
            const cap = Math.round(item.tankCapacityLiters).toLocaleString('en-IN');
            const percent = Math.min(100, Math.round(item.availablePercent));

            return (
              <Box key={item.fuelTypeId}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    {item.shortCode}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem' }}
                  >
                    {liters}{' '}
                    <Typography component="span" variant="caption" color="text.secondary">
                      / {cap} L ({percent}%)
                    </Typography>
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={percent}
                  sx={{
                    height: 7,
                    borderRadius: 1,
                    bgcolor: (t) => alpha(t.palette.divider, 0.6),
                    '& .MuiLinearProgress-bar': { borderRadius: 1, bgcolor: healthColor },
                  }}
                />
              </Box>
            );
          })}
        </Stack>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            fontSize: '0.75rem',
            display: 'block',
            mt: 2,
            pt: 1.25,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          {lastDipTime ? `Last dip: ${lastDipTime}` : 'Last dip: Not recorded today'}
        </Typography>

        {variationBlock}
      </Box>

      <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button
          component={RouterLink}
          to={dailyDipReportPath(variationIso)}
          size="small"
          endIcon={<ArrowForwardOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.82rem',
            p: 0,
            alignSelf: 'flex-start',
            color: 'primary.main',
            '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
          }}
        >
          Daily Dip Report
        </Button>
      </Box>
    </Paper>
  );
}
