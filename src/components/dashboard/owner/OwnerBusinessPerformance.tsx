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
import { useReducedMotion } from '@/hooks/useReducedMotion';

type PeriodRow = { label: string; amount: number };

const CHART_PLOT_HEIGHT = { xs: 92, sm: 108 };
/** Max bar height inside plot area (proportional to maxTrend). */
const TREND_BAR_SCALE_PX = 76;
const ZERO_BAR_PX = 5;
const MIN_POSITIVE_BAR_PX = 8;

type Props = {
  pumpDayIso: string;
};

function TrendChartTooltip({ dateLabel, amount }: { dateLabel: string; amount: number }) {
  const heading = dateLabel.replace('-', ' ');
  return (
    <Stack spacing={0.25} sx={{ py: 0.25, px: 0.5, minWidth: 112, textAlign: 'center' }}>
      <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '0.02em', color: 'common.white' }}>
        {heading}
      </Typography>
      <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'grey.300', fontWeight: 600 }}>
        Sales
      </Typography>
      <Typography
        variant="body2"
        sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'common.white', lineHeight: 1.3 }}
      >
        {fmtInrCompact(amount, 0)}
      </Typography>
    </Stack>
  );
}

export function OwnerBusinessPerformance({ pumpDayIso }: Props) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
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

  const vsYesterdayPct = useMemo(() => {
    if (yesterdayAmount <= 0) return null;
    const diff = todayAmount - yesterdayAmount;
    return (diff / yesterdayAmount) * 100;
  }, [todayAmount, yesterdayAmount]);

  const sectionPaperSx = {
    p: { xs: 2, sm: 2.5 },
    borderRadius: 3.5,
    border: '1px solid',
    borderColor: 'divider',
    bgcolor: 'background.paper',
    boxShadow: (t: typeof theme) =>
      t.palette.mode === 'dark'
        ? '0 4px 24px rgba(0,0,0,0.35)'
        : '0 4px 20px rgba(15, 23, 42, 0.06)',
  } as const;

  if (loading) {
    return (
      <Paper elevation={0} sx={{ ...sectionPaperSx, minHeight: 180, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress size={24} />
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={sectionPaperSx}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: { xs: 1.75, sm: 2 }, gap: 1 }}
      >
        <Typography
          variant="caption"
          component="h2"
          sx={{
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'text.secondary',
            fontSize: { xs: '0.7rem', sm: '0.72rem' },
            lineHeight: 1.2,
          }}
        >
          BUSINESS PERFORMANCE
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 2,
            flexShrink: 0,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
            color: 'primary.main',
            border: '1px solid',
            borderColor: (t) => alpha(t.palette.primary.main, 0.18),
          }}
        >
          <BarChartOutlinedIcon sx={{ fontSize: 17 }} />
        </Box>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
          gap: { xs: 1.25, sm: 1.5 },
          mb: { xs: 1.75, sm: 2 },
        }}
      >
        {periods.map((p) => {
          const isToday = p.label === 'Today';
          const comparisonUp = vsYesterdayPct != null && vsYesterdayPct >= 0;
          const comparisonColor = comparisonUp ? 'success.main' : 'error.main';

          return (
            <Box
              key={p.label}
              sx={{
                p: { xs: 1.35, sm: 1.5 },
                minHeight: { xs: 88, sm: 96 },
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '15px',
                bgcolor: (t) =>
                  t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.04) : '#f9fafb',
                border: '1px solid',
                borderColor: (t) => alpha(t.palette.divider, t.palette.mode === 'dark' ? 0.55 : 1),
                boxShadow: (t) =>
                  t.palette.mode === 'dark' ? 'none' : '0 1px 3px rgba(15, 23, 42, 0.04)',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  letterSpacing: '0.02em',
                  display: 'block',
                  mb: 0.5,
                }}
              >
                {p.label}
              </Typography>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: { xs: '1.05rem', sm: '1.2rem' },
                  lineHeight: 1.15,
                  letterSpacing: '-0.02em',
                  color: 'text.primary',
                  flex: '0 0 auto',
                }}
              >
                {fmtInrCompact(p.amount, 0)}
              </Typography>
              <Box sx={{ flex: 1, minHeight: 4 }} />
              {isToday && vsYesterdayPct != null ? (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    alignSelf: 'flex-start',
                    gap: 0.35,
                    mt: 'auto',
                    px: 0.85,
                    py: 0.35,
                    borderRadius: 999,
                    bgcolor: (t) => alpha(t.palette[comparisonUp ? 'success' : 'error'].main, 0.08),
                    border: '1px solid',
                    borderColor: (t) => alpha(t.palette[comparisonUp ? 'success' : 'error'].main, 0.22),
                  }}
                >
                  {comparisonUp ? (
                    <TrendingUpIcon sx={{ fontSize: 14, color: comparisonColor }} />
                  ) : (
                    <TrendingDownIcon sx={{ fontSize: 14, color: comparisonColor }} />
                  )}
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.65rem',
                      color: comparisonColor,
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {comparisonUp ? '↑' : '↓'} {Math.abs(vsYesterdayPct).toFixed(1)}% vs y'day
                  </Typography>
                </Box>
              ) : null}
            </Box>
          );
        })}
      </Box>

      <Box
        sx={{
          pt: { xs: 1.25, sm: 1.5 },
          borderTop: '1px solid',
          borderColor: (t) => alpha(t.palette.divider, 0.85),
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: 'text.secondary',
            fontSize: '0.65rem',
            textTransform: 'uppercase',
            display: 'block',
            mb: { xs: 1.25, sm: 1.5 },
          }}
        >
          SALES TREND (7 DAYS)
        </Typography>

        {!hasTrendData ? (
          <Box
            sx={{
              py: 2.25,
              px: 1.5,
              borderRadius: '15px',
              bgcolor: (t) =>
                t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.04) : '#f9fafb',
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
          <Box sx={{ px: { xs: 0.25, sm: 0.5 } }}>
            <Box
              sx={{
                position: 'relative',
                height: CHART_PLOT_HEIGHT,
                display: 'flex',
                alignItems: 'flex-end',
                borderBottom: '2px solid',
                borderColor: (t) => alpha(t.palette.divider, 0.9),
                pb: 0,
              }}
            >
              <Stack
                direction="row"
                alignItems="flex-end"
                spacing={{ xs: 0.5, sm: 0.75 }}
                sx={{ width: '100%', height: '100%' }}
              >
                {trend.map((bar, index) => {
                  const barPx =
                    bar.amount > 0
                      ? Math.max(
                          MIN_POSITIVE_BAR_PX,
                          Math.round((bar.amount / maxTrend) * TREND_BAR_SCALE_PX),
                        )
                      : ZERO_BAR_PX;
                  const isPeak = bar.amount > 0 && bar.amount === maxTrend;

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
                          title={<TrendChartTooltip dateLabel={bar.label} amount={bar.amount} />}
                          arrow
                          placement="top"
                          enterTouchDelay={0}
                          slotProps={{
                            tooltip: {
                              sx: {
                                bgcolor: 'grey.900',
                                borderRadius: 2,
                                px: 1.25,
                                py: 1,
                                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.28)',
                                '& .MuiTooltip-arrow': { color: 'grey.900' },
                              },
                            },
                          }}
                        >
                          <Box
                            sx={{
                              width: { xs: '68%', sm: '72%' },
                              maxWidth: 36,
                              height: barPx,
                              borderRadius: '8px 8px 3px 3px',
                              bgcolor:
                                bar.amount > 0
                                  ? isPeak
                                    ? 'primary.main'
                                    : alpha(theme.palette.primary.main, 0.82)
                                  : alpha(theme.palette.text.primary, 0.12),
                              cursor: 'pointer',
                              transformOrigin: 'bottom center',
                              transition: 'background-color 0.18s ease, transform 0.18s ease',
                              animation: reducedMotion
                                ? 'none'
                                : `ownerTrendBarGrow 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.05}s both`,
                              '@keyframes ownerTrendBarGrow': {
                                from: { transform: 'scaleY(0)', opacity: 0.35 },
                                to: { transform: 'scaleY(1)', opacity: 1 },
                              },
                              '&:hover': {
                                bgcolor: bar.amount > 0 ? 'primary.dark' : alpha(theme.palette.text.primary, 0.2),
                                transform: bar.amount > 0 ? 'scaleY(1.03)' : 'none',
                              },
                            }}
                          />
                        </Tooltip>
                      </Box>
                    </Stack>
                  );
                })}
              </Stack>
            </Box>

            <Stack
              direction="row"
              spacing={{ xs: 0.5, sm: 0.75 }}
              sx={{ mt: 1, width: '100%' }}
            >
              {trend.map((bar) => (
                <Typography
                  key={`${bar.label}-axis`}
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'center',
                    fontSize: { xs: '0.62rem', sm: '0.68rem' },
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0.01em',
                  }}
                  noWrap
                >
                  {bar.label}
                </Typography>
              ))}
            </Stack>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
