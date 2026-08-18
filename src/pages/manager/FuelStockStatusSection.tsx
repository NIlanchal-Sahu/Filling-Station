import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  alpha,
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  LinearProgress,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';

import {
  formatFuelLiters,
  formatFuelPercent,
  getFuelStockOverview,
} from '@/services/fuelStockService';
import type { FuelStockItem, FuelStockOverview } from '@/types/entities';
import {
  FUEL_STOCK_UPDATED_EVENT,
  fuelStockHealthColor,
  fuelStockHealthEmoji,
  fuelStockHealthLabel,
} from '@/utils/fuelStockDisplay';
import { formatDipCm } from '@/utils/fuelTankCalibration';

function AnimatedProgressBar(props: { value: number; color: string }) {
  const { value, color } = props;
  return (
    <LinearProgress
      variant="determinate"
      value={value}
      sx={{
        height: 10,
        borderRadius: 999,
        bgcolor: (t) => alpha(t.palette.divider, 0.35),
        '& .MuiLinearProgress-bar': {
          borderRadius: 999,
          bgcolor: color,
          transition: 'transform 0.6s ease',
        },
      }}
    />
  );
}

function FuelStockCard(props: { item: FuelStockItem; onClick: () => void }) {
  const theme = useTheme();
  const { item, onClick } = props;
  const accent = fuelStockHealthColor(item.health, theme);

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
      <CardActionArea onClick={onClick} sx={{ height: '100%', alignItems: 'stretch' }}>
        <Box sx={{ height: 3, bgcolor: accent }} />
        <CardContent sx={{ pt: 2.25, pb: 2.5, px: 2.5 }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                {item.shortCode}
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 0.25 }}>
                {item.displayName}
              </Typography>
            </Box>

            <Stack spacing={0.75}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Dip reading
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {item.currentDipCm != null ? formatDipCm(item.currentDipCm) : '—'}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Current stock
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {formatFuelLiters(item.currentStockLiters)}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Tank capacity
                </Typography>
                <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatFuelLiters(item.tankCapacityLiters)}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Available
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {formatFuelPercent(item.availablePercent)}
                </Typography>
              </Stack>
            </Stack>

            <Box>
              <AnimatedProgressBar value={item.availablePercent} color={accent} />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                Progress: {formatFuelPercent(item.availablePercent)}
              </Typography>
            </Box>

            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Status: {fuelStockHealthEmoji(item.health)} {fuelStockHealthLabel(item.health)}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export function FuelStockStatusSection() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<FuelStockOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setOverview(await getFuelStockOverview());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load fuel stock');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const onRefresh = () => void load();
    window.addEventListener(FUEL_STOCK_UPDATED_EVENT, onRefresh);
    window.addEventListener('focus', onRefresh);
    return () => {
      window.removeEventListener(FUEL_STOCK_UPDATED_EVENT, onRefresh);
      window.removeEventListener('focus', onRefresh);
    };
  }, [load]);

  const alerts = useMemo(() => {
    if (!overview?.hasData) return [];
    const messages: string[] = [];
    for (const item of overview.items) {
      if (item.health === 'critical') {
        messages.push(`${item.shortCode} stock is below 20%. Refill required.`);
      }
      if (item.atOrBelowReserve) {
        messages.push(`${item.shortCode} has reached reserve level (${formatFuelLiters(item.reserveLiters)}).`);
      }
      if (!item.updatedToday) {
        messages.push(`${item.shortCode} tank reading not updated today.`);
      }
    }
    return messages;
  }, [overview]);

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <LocalGasStationOutlinedIcon color="primary" />
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            ⛽ Fuel Stock Status
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Current fuel inventory and tank utilization.
          </Typography>
        </Box>
      </Stack>

      {err ? <Alert severity="error">{err}</Alert> : null}

      {loading ? (
        <Card
          elevation={0}
          sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', py: 6, display: 'flex', justifyContent: 'center' }}
        >
          <CircularProgress size={36} />
        </Card>
      ) : !overview?.hasData ? (
        <Alert severity="info">
          No stock information available for today. Please update tank dip readings.
        </Alert>
      ) : (
        <Stack spacing={2}>
          {alerts.length > 0 ? (
            <Stack spacing={1}>
              {alerts.map((msg) => (
                <Alert key={msg} severity="warning" icon={false} sx={{ borderRadius: 2 }}>
                  ⚠️ {msg}
                </Alert>
              ))}
            </Stack>
          ) : null}

          <Card
            elevation={0}
            sx={{
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              background: (t) =>
                `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.06)} 0%, ${alpha(t.palette.info.main, 0.04)} 100%)`,
            }}
          >
            <CardContent sx={{ py: 2.25, px: 2.5 }}>
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Total fuel stock
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {formatFuelLiters(overview.totalStockLiters)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Total capacity
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {formatFuelLiters(overview.totalCapacityLiters)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                    Overall utilization
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'primary.main' }}>
                    {formatFuelPercent(overview.overallUtilizationPercent)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            }}
          >
            {overview.items.map((item) => (
              <FuelStockCard
                key={item.fuelTypeId}
                item={item}
                onClick={() => navigate(`/manager/fuel-stock/${item.fuelTypeId}`)}
              />
            ))}
          </Box>

          <Typography variant="caption" color="text.secondary">
            Tap a fuel card for dip history. Readings refresh automatically after dip entry.
          </Typography>
        </Stack>
      )}
    </Stack>
  );
}
