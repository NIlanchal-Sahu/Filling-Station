import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  alpha,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import PropaneTankOutlinedIcon from '@mui/icons-material/PropaneTankOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { format } from 'date-fns';
import { getFuelStockOverview } from '@/services/fuelStockService';
import { getTankStockDaySummary } from '@/services/fuelStockReconciliationService';
import type { FuelStockOverview } from '@/types/entities';
import { FUEL_STOCK_UPDATED_EVENT, fuelStockHealthColor } from '@/utils/fuelStockDisplay';
import { VARIATION_ALERT_LITERS } from '@/utils/fuelStockConstants';
import { withPumpDayQuery } from '@/utils/dateEntryPolicy';

type Props = {
  pumpDayIso: string;
};

export function OwnerFuelInventorySummary({ pumpDayIso }: Props) {
  const theme = useTheme();
  const [overview, setOverview] = useState<FuelStockOverview | null>(null);
  const [variationAlerts, setVariationAlerts] = useState<string[]>([]);
  const [lastDipTime, setLastDipTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, tank] = await Promise.all([
        getFuelStockOverview(),
        getTankStockDaySummary(pumpDayIso).catch(() => null),
      ]);
      setOverview(o);
      const alerts: string[] = [];
      if (tank) {
        for (const row of tank.rows) {
          if (
            row.variationAlert &&
            row.variationLiters != null &&
            Math.abs(row.variationLiters) >= VARIATION_ALERT_LITERS
          ) {
            alerts.push(
              `${row.shortCode}: ${row.variationLiters > 0 ? '+' : ''}${row.variationLiters.toLocaleString('en-IN')} L`,
            );
          }
        }
      }
      setVariationAlerts(alerts);
      let latest: number | undefined;
      for (const item of o.items) {
        const ms = item.lastDipAt ? item.lastDipAt.toMillis() : undefined;
        if (ms && (!latest || ms > latest)) latest = ms;
      }
      setLastDipTime(latest ? format(new Date(latest), 'hh:mm a') : null);
    } finally {
      setLoading(false);
    }
  }, [pumpDayIso]);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener(FUEL_STOCK_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(FUEL_STOCK_UPDATED_EVENT, refresh);
  }, [load]);

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

  // Priority 9: Compact empty state if no tank readings exist
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
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%',
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
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 2,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
              color: 'primary.main',
            }}
          >
            <PropaneTankOutlinedIcon sx={{ fontSize: 16 }} />
          </Box>
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

        <Box sx={{ pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button
            component={RouterLink}
            to={withPumpDayQuery('/manager/fuel-stock/daily', pumpDayIso)}
            size="small"
            endIcon={<ArrowForwardOutlinedIcon sx={{ fontSize: 16 }} />}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.82rem',
              p: 0,
              color: 'primary.main',
              '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
            }}
          >
            View Tank &amp; Dip
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
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 2,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
              color: 'primary.main',
            }}
          >
            <PropaneTankOutlinedIcon sx={{ fontSize: 16 }} />
          </Box>
        </Stack>

        {/* Tanks progress bars */}
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
                    {liters} <Typography component="span" variant="caption" color="text.secondary">/ {cap} L ({percent}%)</Typography>
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

        {/* Dip time & variation status */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mt: 2, pt: 1.25, borderTop: '1px solid', borderColor: 'divider' }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
            {lastDipTime ? `Last dip: ${lastDipTime}` : 'Last dip: Not recorded today'}
          </Typography>

          {variationAlerts.length > 0 ? (
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <WarningAmberIcon sx={{ fontSize: 14, color: 'warning.main' }} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'warning.dark', fontSize: '0.72rem' }}>
                {variationAlerts[0]}
              </Typography>
            </Stack>
          ) : (
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <CheckCircleOutlineIcon sx={{ fontSize: 14, color: 'success.main' }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'success.main', fontSize: '0.72rem' }}>
                Dip variation normal
              </Typography>
            </Stack>
          )}
        </Stack>
      </Box>

      {/* Action link */}
      <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button
          component={RouterLink}
          to={withPumpDayQuery('/manager/fuel-stock/daily', pumpDayIso)}
          size="small"
          endIcon={<ArrowForwardOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.82rem',
            p: 0,
            color: 'primary.main',
            '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
          }}
        >
          View Tank &amp; Dip
        </Button>
      </Box>
    </Paper>
  );
}
