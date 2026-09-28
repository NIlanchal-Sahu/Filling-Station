import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  alpha,
  Alert,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import { format } from 'date-fns';
import { getFuelStockOverview } from '@/services/fuelStockService';
import { getTankStockDaySummary } from '@/services/fuelStockReconciliationService';
import type { FuelStockOverview } from '@/types/entities';
import { FUEL_STOCK_UPDATED_EVENT, fuelStockHealthColor } from '@/utils/fuelStockDisplay';
import { VARIATION_ALERT_LITERS } from '@/utils/fuelStockConstants';
import { panelCardSx, panelTitleSx } from '@/components/dashboard/owner/ownerPanelStyles';
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
      const [o, tank] = await Promise.all([getFuelStockOverview(), getTankStockDaySummary(pumpDayIso).catch(() => null)]);
      setOverview(o);
      const alerts: string[] = [];
      if (tank) {
        for (const row of tank.rows) {
          if (row.variationAlert && row.variationLiters != null && Math.abs(row.variationLiters) >= VARIATION_ALERT_LITERS) {
            alerts.push(`${row.shortCode}: ${row.variationLiters > 0 ? '+' : ''}${row.variationLiters.toLocaleString('en-IN')} L variation`);
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
      <Box sx={{ ...panelCardSx, display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!overview?.hasData) {
    return (
      <Box sx={panelCardSx}>
        <Typography sx={panelTitleSx}>Fuel &amp; inventory</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          No tank readings on file yet.
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mt: 1.25 }}>
          <Button
            component={RouterLink}
            to={withPumpDayQuery('/manager/fuel-stock/daily', pumpDayIso)}
            size="small"
            endIcon={<ArrowForwardOutlinedIcon />}
            sx={{ textTransform: 'none', fontWeight: 600, px: 0 }}
          >
            View tank &amp; dip details
          </Button>
          <Button
            component={RouterLink}
            to={withPumpDayQuery('/manager/fuel-stock/purchase', pumpDayIso)}
            size="small"
            endIcon={<ArrowForwardOutlinedIcon />}
            sx={{ textTransform: 'none', fontWeight: 600, px: 0 }}
          >
            View fuel purchases
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={panelCardSx}>
      <Typography sx={{ ...panelTitleSx, mb: 1.5 }}>Fuel &amp; inventory</Typography>
      {variationAlerts.length > 0 ? (
        <Alert severity="warning" sx={{ mb: 1.5, borderRadius: 1.5, py: 0.25 }}>
          {variationAlerts.join(' · ')}
        </Alert>
      ) : null}
      <Stack spacing={1.75}>
        {overview.items.map((item) => {
          const color = fuelStockHealthColor(item.health, theme);
          const liters = Math.round(item.currentStockLiters).toLocaleString('en-IN');
          const cap = Math.round(item.tankCapacityLiters).toLocaleString('en-IN');
          return (
            <Box key={item.fuelTypeId}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {item.shortCode}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {liters} / {cap} L
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={item.availablePercent}
                sx={{
                  height: 8,
                  borderRadius: 999,
                  bgcolor: alpha(theme.palette.divider, 0.35),
                  '& .MuiLinearProgress-bar': { borderRadius: 999, bgcolor: color },
                }}
              />
            </Box>
          );
        })}
      </Stack>
      {lastDipTime ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          Latest dip: {lastDipTime}
        </Typography>
      ) : null}
      <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mt: 1.5 }}>
        <Button
          component={RouterLink}
          to={withPumpDayQuery('/manager/fuel-stock/daily', pumpDayIso)}
          size="small"
          endIcon={<ArrowForwardOutlinedIcon />}
          sx={{ textTransform: 'none', fontWeight: 600, px: 0 }}
        >
          View tank &amp; dip details
        </Button>
        <Button
          component={RouterLink}
          to={withPumpDayQuery('/manager/fuel-stock/purchase', pumpDayIso)}
          size="small"
          endIcon={<ArrowForwardOutlinedIcon />}
          sx={{ textTransform: 'none', fontWeight: 600, px: 0 }}
        >
          View fuel purchases
        </Button>
      </Stack>
    </Box>
  );
}
