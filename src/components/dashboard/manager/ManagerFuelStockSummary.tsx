import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  alpha,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import { getFuelStockOverview } from '@/services/fuelStockService';
import type { FuelStockOverview } from '@/types/entities';
import { FUEL_STOCK_UPDATED_EVENT, fuelStockHealthColor } from '@/utils/fuelStockDisplay';
import { format } from 'date-fns';
import { panelCardSx, panelTitleSx } from '@/components/dashboard/manager/dashboardPanelStyles';
import { usePermissions } from '@/hooks/usePermissions';

const actionBtnSx = { textTransform: 'none', fontWeight: 600, px: 0 } as const;

function FuelStockActions({
  pumpDayIso,
  dipTo,
  showRecordPurchase,
}: {
  pumpDayIso: string;
  dipTo: string;
  showRecordPurchase: boolean;
}) {
  return (
    <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mt: 1.5 }}>
      <Button component={RouterLink} to={dipTo} size="small" endIcon={<ArrowForwardOutlinedIcon />} sx={actionBtnSx}>
        View tank details
      </Button>
      {showRecordPurchase ? (
        <Button
          component={RouterLink}
          to={`/manager/fuel-stock/purchase?day=${pumpDayIso}`}
          size="small"
          endIcon={<ArrowForwardOutlinedIcon />}
          sx={actionBtnSx}
        >
          Record purchase
        </Button>
      ) : null}
    </Stack>
  );
}

function lastDipLabel(isoMs: number | undefined): string | null {
  if (!isoMs) return null;
  return format(new Date(isoMs), 'hh:mm a');
}

type Props = {
  pumpDayIso: string;
};

export function ManagerFuelStockSummary({ pumpDayIso }: Props) {
  const theme = useTheme();
  const { can } = usePermissions();
  const canRecordPurchase = can('edit:fuel');
  const [overview, setOverview] = useState<FuelStockOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastDipTime, setLastDipTime] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const o = await getFuelStockOverview();
      setOverview(o);
      let latest: number | undefined;
      for (const item of o.items) {
        const ms = item.lastDipAt ? item.lastDipAt.toMillis() : undefined;
        if (ms && (!latest || ms > latest)) latest = ms;
      }
      setLastDipTime(lastDipLabel(latest));
    } finally {
      setLoading(false);
    }
  }, []);

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
      <Box id="fuel-stock" sx={panelCardSx}>
        <Typography sx={panelTitleSx}>Fuel stock &amp; tanks</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          No tank data yet — enter a dip reading to start tracking stock.
        </Typography>
        <FuelStockActions
          pumpDayIso={pumpDayIso}
          dipTo={`/manager/fuel-stock/daily?day=${pumpDayIso}`}
          showRecordPurchase={canRecordPurchase}
        />
      </Box>
    );
  }

  return (
    <Box id="fuel-stock" sx={panelCardSx}>
      <Typography sx={{ ...panelTitleSx, mb: 1.5 }}>Fuel stock &amp; tanks</Typography>
      <Stack spacing={1.75}>
        {overview.items.map((item) => {
          const color = fuelStockHealthColor(item.health, theme);
          const liters = Math.round(item.currentStockLiters).toLocaleString('en-IN');
          const cap = Math.round(item.tankCapacityLiters).toLocaleString('en-IN');
          return (
            <Box key={item.fuelTypeId}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {item.shortCode}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {liters} L
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
              <Typography variant="caption" color="text.secondary">
                {liters} / {cap} L
              </Typography>
            </Box>
          );
        })}
      </Stack>
      {lastDipTime ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          Last dip check: {lastDipTime}
        </Typography>
      ) : null}
      <FuelStockActions
        pumpDayIso={pumpDayIso}
        dipTo={`/manager/fuel-stock/daily?day=${pumpDayIso}`}
        showRecordPurchase={canRecordPurchase}
      />
    </Box>
  );
}
