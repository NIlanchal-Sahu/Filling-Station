import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { alpha, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import { getSalesByFuelForRange } from '@/services/aggregatesService';
import { FUEL_CHART_COLORS } from '@/utils/fuelSalesChartDisplay';
import { fmtInrCompact } from '@/components/dashboard/manager/dashboardPanelStyles';
import { withPumpDayQuery } from '@/utils/dateEntryPolicy';

type Props = {
  pumpDayIso: string;
};

function fmtL(n: number): string {
  return `${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })} L`;
}

export function ManagerSalesFuelSummary({ pumpDayIso }: Props) {
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

  const maxLiters = useMemo(() => Math.max(...rows.map((r) => r.liters), 1), [rows]);

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
      id="today-sales"
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
            SALES BY FUEL
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
            <LocalGasStationOutlinedIcon sx={{ fontSize: 16 }} />
          </Box>
        </Stack>

        <Stack spacing={1.5}>
          {rows.map(({ code, liters, amount }) => {
            const barWidthPercent = liters > 0 ? Math.max(4, Math.round((liters / maxLiters) * 100)) : 0;
            const fuelColor = FUEL_CHART_COLORS[code] ?? '#0284c7';

            return (
              <Box key={code}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.5 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: fuelColor, flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                      {code}
                    </Typography>
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: '0.85rem' }}
                  >
                    {fmtInrCompact(amount, 0)}
                  </Typography>
                </Stack>

                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Box
                    sx={{
                      flex: 1,
                      height: 8,
                      borderRadius: 1,
                      bgcolor: (t) => alpha(t.palette.divider, 0.6),
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        height: '100%',
                        width: `${barWidthPercent}%`,
                        bgcolor: fuelColor,
                        borderRadius: 1,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      minWidth: 54,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                    }}
                  >
                    {fmtL(liters)}
                  </Typography>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </Box>

      <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline">
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
            Total Fuel Sales
          </Typography>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="body2" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
              {fmtInrCompact(totalAmount, 0)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.72rem' }}>
              {fmtL(totalLiters)}
            </Typography>
          </Box>
        </Stack>

        <Button
          component={RouterLink}
          to={withPumpDayQuery('/manager/sales', pumpDayIso)}
          size="small"
          endIcon={<ArrowForwardOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{
            mt: 1,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.82rem',
            p: 0,
            color: 'primary.main',
            '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
          }}
        >
          View Shift Sales
        </Button>
      </Box>
    </Paper>
  );
}
