import { useCallback, useEffect, useMemo, useState } from 'react';
import { alpha, Box, CircularProgress, Paper, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import { format, parseISO, subDays } from 'date-fns';
import {
  getDailySalesFuelPivot,
  getPumpDaySalesOverview,
  getSalesByFuelForRange,
} from '@/services/aggregatesService';
import { resolveSalesByFuelRange } from '@/utils/fuelSalesChartDisplay';
import { fmtInrCompact } from '@/components/dashboard/owner/ownerPanelStyles';

type PeriodRow = { label: string; amount: number };

const TREND_CHART_INNER_PX = 56;

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
  const hasTrendData = useMemo(() => trend.some((t) => t.amount > 0), [trend]);

  const todayAmount = periods.find((p) => p.label === 'Today')?.amount ?? 0;
  const yesterdayAmount = periods.find((p) => p.label === 'Yesterday')?.amount ?? 0;

  // Real comparison calculation only if yesterday had positive sales
  const vsYesterdayPct = useMemo(() => {
    if (yesterdayAmount <= 0) return null;
    const diff = todayAmount - yesterdayAmount;
    return (diff / yesterdayAmount) * 100;
  }, [todayAmount, yesterdayAmount]);

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
          BUSINESS PERFORMANCE
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
          <BarChartOutlinedIcon sx={{ fontSize: 16 }} />
        </Box>
      </Stack>

      {/* 4 Periods Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
          gap: 1.25,
          mb: 2,
        }}
      >
        {periods.map((p) => {
          const isToday = p.label === 'Today';
          return (
            <Box
              key={p.label}
              sx={{
                p: 1.25,
                borderRadius: 2,
                bgcolor: (t) =>
                  t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.04) : '#f8fafc',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 600,
                  fontSize: '0.72rem',
                  display: 'block',
                }}
              >
                {p.label}
              </Typography>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: { xs: '1rem', sm: '1.1rem' },
                  lineHeight: 1.25,
                  mt: 0.25,
                }}
              >
                {fmtInrCompact(p.amount, 0)}
              </Typography>
              {isToday && vsYesterdayPct != null ? (
                <Stack direction="row" alignItems="center" spacing={0.25} sx={{ mt: 0.5 }}>
                  {vsYesterdayPct >= 0 ? (
                    <TrendingUpIcon sx={{ fontSize: 13, color: 'success.main' }} />
                  ) : (
                    <TrendingDownIcon sx={{ fontSize: 13, color: 'error.main' }} />
                  )}
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.68rem',
                      color: vsYesterdayPct >= 0 ? 'success.main' : 'error.main',
                    }}
                  >
                    {vsYesterdayPct >= 0 ? '↑' : '↓'} {Math.abs(vsYesterdayPct).toFixed(1)}% vs y'day
                  </Typography>
                </Stack>
              ) : null}
            </Box>
          );
        })}
      </Box>

      {/* 7-day sales chart or compact empty state */}
      <Box sx={{ pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            letterSpacing: '0.05em',
            color: 'text.secondary',
            fontSize: '0.65rem',
            textTransform: 'uppercase',
            display: 'block',
            mb: 1,
          }}
        >
          SALES TREND (7 DAYS)
        </Typography>

        {!hasTrendData ? (
          <Box
            sx={{
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
              No sufficient sales data for a trend yet.
            </Typography>
          </Box>
        ) : (
          <Stack
            direction="row"
            alignItems="flex-end"
            spacing={0.75}
            sx={{
              height: { xs: 56, sm: 64 },
              px: 0.5,
            }}
          >
            {trend.map((bar) => {
              const barPx =
                bar.amount > 0
                  ? Math.max(6, Math.round((bar.amount / maxTrend) * TREND_CHART_INNER_PX))
                  : 4;
              return (
                <Stack key={bar.label} alignItems="center" sx={{ flex: 1, minWidth: 0, height: '100%' }}>
                  <Box
                    sx={{
                      flex: 1,
                      width: '100%',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      minHeight: 0,
                    }}
                  >
                    <Tooltip
                      title={`${bar.label}: ${fmtInrCompact(bar.amount, 0)}`}
                      arrow
                      placement="top"
                    >
                      <Box
                        sx={{
                          width: '75%',
                          maxWidth: 28,
                          height: barPx,
                          borderRadius: '4px 4px 1px 1px',
                          bgcolor: bar.amount > 0 ? 'primary.main' : alpha(theme.palette.divider, 0.9),
                          transition: 'height 0.2s ease, opacity 0.15s ease',
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: 'primary.dark',
                          },
                        }}
                      />
                    </Tooltip>
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: '0.65rem', mt: 0.5, maxWidth: '100%', fontVariantNumeric: 'tabular-nums' }}
                    noWrap
                  >
                    {bar.label}
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
        )}
      </Box>
    </Paper>
  );
}
