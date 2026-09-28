import { useCallback, useEffect, useMemo, useState } from 'react';
import { alpha, Box, CircularProgress, Stack, Typography, useTheme } from '@mui/material';
import { format, parseISO, subDays } from 'date-fns';
import {
  getDailySalesFuelPivot,
  getPumpDaySalesOverview,
  getSalesByFuelForRange,
} from '@/services/aggregatesService';
import { resolveSalesByFuelRange } from '@/utils/fuelSalesChartDisplay';
import {
  fmtInrCompact,
  OWNER_DASHBOARD_PANEL_MIN_H,
  panelStretchSx,
  panelTitleSx,
} from '@/components/dashboard/owner/ownerPanelStyles';

type PeriodRow = { label: string; amount: number };

const TREND_CHART_INNER_PX = 48;

type Props = {
  pumpDayIso: string;
};

export function OwnerBusinessPerformance({ pumpDayIso }: Props) {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [trend, setTrend] = useState<{ label: string; amount: number }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const anchor = parseISO(`${pumpDayIso}T12:00:00`);
      const yesterdayIso = format(subDays(anchor, 1), 'yyyy-MM-dd');
      const week = resolveSalesByFuelRange(pumpDayIso, 'weekly');
      const month = resolveSalesByFuelRange(pumpDayIso, 'monthly');

      const [todayOv, yesterdayOv, weekSales, monthSales, pivot] = await Promise.all([
        getPumpDaySalesOverview(pumpDayIso),
        getPumpDaySalesOverview(yesterdayIso),
        getSalesByFuelForRange(week.fromIso, week.toIso),
        getSalesByFuelForRange(month.fromIso, month.toIso),
        getDailySalesFuelPivot(subDays(anchor, 6), anchor),
      ]);

      setPeriods([
        { label: 'Today', amount: todayOv.meterSalesAmount },
        { label: 'Yesterday', amount: yesterdayOv.meterSalesAmount },
        { label: 'This week', amount: weekSales.totalAmount },
        { label: 'This month', amount: monthSales.totalAmount },
      ]);
      setTrend(pivot.map((r) => ({ label: r.dateLabel, amount: r.totalAmount })));
    } finally {
      setLoading(false);
    }
  }, [pumpDayIso]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxTrend = useMemo(() => Math.max(...trend.map((t) => t.amount), 1), [trend]);

  if (loading) {
    return (
      <Box
        sx={{
          ...panelStretchSx,
          minHeight: OWNER_DASHBOARD_PANEL_MIN_H,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={panelStretchSx}>
      <Typography sx={{ ...panelTitleSx, mb: 1.25 }}>Business performance</Typography>
      <Stack spacing={0.75} sx={{ mb: { xs: 1.25, sm: 2 } }}>
        {periods.map((p) => (
          <Stack key={p.label} direction="row" justifyContent="space-between" alignItems="baseline" gap={1}>
            <Typography variant="body2" color="text.secondary">
              {p.label}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {fmtInrCompact(p.amount, 0)}
            </Typography>
          </Stack>
        ))}
      </Stack>
      {trend.length > 0 ? (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.05em' }}>
            SALES TREND (7 DAYS)
          </Typography>
          <Stack
            direction="row"
            alignItems="flex-end"
            spacing={0.75}
            sx={{
              mt: 1,
              height: { xs: 56, sm: 64 },
            }}
          >
            {trend.map((bar) => {
              const barPx =
                bar.amount > 0
                  ? Math.max(4, Math.round((bar.amount / maxTrend) * TREND_CHART_INNER_PX))
                  : 4;
              return (
                <Stack key={bar.label} alignItems="center" sx={{ flex: 1, minWidth: 0, height: '100%' }}>
                  <Box
                    sx={{
                      flex: 1,
                      width: '100%',
                      maxWidth: 36,
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      minHeight: 0,
                    }}
                  >
                    <Box
                      sx={{
                        width: '70%',
                        maxWidth: 28,
                        height: barPx,
                        borderRadius: 1,
                        bgcolor: bar.amount > 0 ? 'primary.main' : alpha(theme.palette.divider, 0.9),
                      }}
                      title={`${bar.label}: ${fmtInrCompact(bar.amount, 0)}`}
                    />
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: '0.65rem', mt: 0.5, maxWidth: '100%' }}
                    noWrap
                  >
                    {bar.label}
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
        </Box>
      ) : null}
    </Box>
  );
}
