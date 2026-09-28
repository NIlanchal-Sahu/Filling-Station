import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import { getSalesByFuelForRange } from '@/services/aggregatesService';
import { FUEL_CHART_COLORS } from '@/utils/fuelSalesChartDisplay';
import { fmtInrCompact, panelCardSx, panelTitleSx } from '@/components/dashboard/owner/ownerPanelStyles';
import { withPumpDayQuery } from '@/utils/dateEntryPolicy';

type Props = {
  pumpDayIso: string;
};

function fmtL(n: number): string {
  return `${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })} L`;
}

export function OwnerSalesFuelSummary({ pumpDayIso }: Props) {
  const [loading, setLoading] = useState(true);
  const [totalLiters, setTotalLiters] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [rows, setRows] = useState<{ code: 'MS' | 'HSD' | 'XP'; liters: number; amount: number }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSalesByFuelForRange(pumpDayIso, pumpDayIso);
      setTotalLiters(data.totalLiters);
      setTotalAmount(data.totalAmount);
      setRows(
        (['MS', 'HSD', 'XP'] as const).map((code) => {
          const row = data.rows.find((r) => r.shortCode === code);
          return { code, liters: row?.liters ?? 0, amount: row?.amount ?? 0 };
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [pumpDayIso]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Box sx={{ ...panelCardSx, display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={panelCardSx}>
      <Typography sx={{ ...panelTitleSx, mb: 1 }}>Sales by fuel</Typography>
      <Stack spacing={0.85}>
        {rows.map(({ code, liters, amount }) => (
          <Stack key={code} direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: FUEL_CHART_COLORS[code], flexShrink: 0 }} />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {code}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {fmtL(liters)}
                </Typography>
              </Box>
            </Stack>
            <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {fmtInrCompact(amount, 0)}
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.25, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          Total
        </Typography>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="body2" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {fmtInrCompact(totalAmount, 0)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {fmtL(totalLiters)}
          </Typography>
        </Box>
      </Stack>
      <Button
        component={RouterLink}
        to={withPumpDayQuery('/owner/shift-sales', pumpDayIso)}
        size="small"
        endIcon={<ArrowForwardOutlinedIcon />}
        sx={{ mt: 1.25, textTransform: 'none', fontWeight: 600, px: 0 }}
      >
        View shift sales
      </Button>
    </Box>
  );
}
