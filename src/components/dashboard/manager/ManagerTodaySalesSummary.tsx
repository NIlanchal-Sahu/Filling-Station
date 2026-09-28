import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import { getTodaySalesByShift, type TodaySalesByShiftSummary } from '@/services/aggregatesService';
import { FUEL_CHART_COLORS } from '@/utils/fuelSalesChartDisplay';
import { SHIFT_SALES_UPDATED_EVENT } from '@/utils/shiftSalesDisplay';
import { fmtInrCompact, panelCardSx, panelTitleSx } from '@/components/dashboard/manager/dashboardPanelStyles';

type Props = {
  pumpDayIso: string;
};

export function ManagerTodaySalesSummary({ pumpDayIso }: Props) {
  const [summary, setSummary] = useState<TodaySalesByShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const day = new Date(`${pumpDayIso}T00:00:00`);
      setSummary(await getTodaySalesByShift(day));
    } finally {
      setLoading(false);
    }
  }, [pumpDayIso]);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener(SHIFT_SALES_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(SHIFT_SALES_UPDATED_EVENT, refresh);
  }, [load]);

  if (loading) {
    return (
      <Box sx={{ ...panelCardSx, display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!summary) return null;

  const { todayTotal, fuelRows } = summary;

  return (
    <Box id="today-sales" sx={panelCardSx}>
      <Typography sx={{ ...panelTitleSx, mb: 1 }}>Today&apos;s sales</Typography>
      <Typography variant="h4" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontSize: { xs: '1.75rem', sm: '2rem' } }}>
        {fmtInrCompact(todayTotal.totalAmount, 2)}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
        {todayTotal.transactionCount.toLocaleString('en-IN')} transactions
      </Typography>
      <Stack spacing={0.75}>
        {(['MS', 'HSD', 'XP'] as const).map((code) => {
          const row = fuelRows.find((r) => r.shortCode === code);
          const amount = row?.totalAmount ?? 0;
          return (
            <Stack key={code} direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: FUEL_CHART_COLORS[code] }} />
                <Typography variant="body2" color="text.secondary">
                  {code}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {fmtInrCompact(amount, 2)}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
      <Button
        component={RouterLink}
        to={`/manager/sales?day=${encodeURIComponent(pumpDayIso)}`}
        size="small"
        endIcon={<ArrowForwardOutlinedIcon />}
        sx={{ mt: 1.5, textTransform: 'none', fontWeight: 600, px: 0 }}
      >
        View sales
      </Button>
    </Box>
  );
}
