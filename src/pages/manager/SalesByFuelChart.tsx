import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import {
  alpha,
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';

import { getSalesByFuelForRange, type FuelSalesChartRow, type SalesByFuelChartData } from '@/services/aggregatesService';
import {
  FUEL_CHART_COLORS,
  fmtChartLiters,
  fmtChartRs,
  resolveSalesByFuelRange,
  type SalesByFuelPeriod,
} from '@/utils/fuelSalesChartDisplay';
import { SHIFT_SALES_UPDATED_EVENT } from '@/utils/shiftSalesDisplay';
import { SHIFT_STATUS_UPDATED_EVENT } from '@/utils/shiftStatusDisplay';

const headSx = {
  fontWeight: 700,
  fontSize: '0.68rem',
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  bgcolor: 'action.hover',
  color: 'text.secondary',
};

function fuelBarColor(code: string, theme: Theme): string {
  if (code === 'MS') return FUEL_CHART_COLORS.MS;
  if (code === 'HSD') return FUEL_CHART_COLORS.HSD;
  if (code === 'XP') return FUEL_CHART_COLORS.XP;
  return theme.palette.primary.main;
}

function FuelBar(props: {
  row: FuelSalesChartRow;
  maxAmount: number;
  onSelect: () => void;
}) {
  const { row, maxAmount, onSelect } = props;
  const color = FUEL_CHART_COLORS[row.shortCode];
  const heightPct = maxAmount > 0 ? Math.max(4, (row.amount / maxAmount) * 100) : 4;

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Typography variant="caption" sx={{ fontWeight: 700, mb: 0.5, fontVariantNumeric: 'tabular-nums' }}>
        {row.contributionPercent.toFixed(1)}%
      </Typography>
      <CardActionArea
        onClick={onSelect}
        sx={{
          width: '100%',
          maxWidth: 88,
          height: { xs: 140, sm: 180 },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          borderRadius: 2,
          bgcolor: (t) => alpha(t.palette.divider, 0.2),
        }}
      >
        <Box
          sx={{
            width: '72%',
            height: `${heightPct}%`,
            borderRadius: '8px 8px 4px 4px',
            bgcolor: color,
            transition: 'height 0.4s ease',
            boxShadow: `0 4px 12px ${alpha(color, 0.35)}`,
          }}
        />
      </CardActionArea>
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mt: 1.25 }}>
        {row.shortCode}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', lineHeight: 1.3 }}>
        {fmtChartRs(row.amount)}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {fmtChartLiters(row.liters)}
      </Typography>
    </Box>
  );
}

export function SalesByFuelChart(props: { pumpDayIso: string }) {
  const theme = useTheme();
  const { pumpDayIso } = props;
  const [period, setPeriod] = useState<SalesByFuelPeriod>('daily');
  const [data, setData] = useState<SalesByFuelChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const range = useMemo(() => resolveSalesByFuelRange(pumpDayIso, period), [pumpDayIso, period]);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setData(await getSalesByFuelForRange(range.fromIso, range.toIso));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load fuel sales');
    } finally {
      setLoading(false);
    }
  }, [range.fromIso, range.toIso]);

  useEffect(() => {
    setLoading(true);
    void load();
    const onRefresh = () => void load();
    window.addEventListener(SHIFT_SALES_UPDATED_EVENT, onRefresh);
    window.addEventListener(SHIFT_STATUS_UPDATED_EVENT, onRefresh);
    window.addEventListener('focus', onRefresh);
    return () => {
      window.removeEventListener(SHIFT_SALES_UPDATED_EVENT, onRefresh);
      window.removeEventListener(SHIFT_STATUS_UPDATED_EVENT, onRefresh);
      window.removeEventListener('focus', onRefresh);
    };
  }, [load]);

  const maxAmount = useMemo(
    () => Math.max(0, ...(data?.rows.map((r) => r.amount) ?? [0])),
    [data],
  );

  const bestSeller = useMemo(() => {
    if (!data?.rows.length || data.totalAmount <= 0) return null;
    return [...data.rows].sort((a, b) => b.amount - a.amount)[0];
  }, [data]);

  const lowestSeller = useMemo(() => {
    if (!data?.rows.length || data.totalAmount <= 0) return null;
    return [...data.rows].sort((a, b) => a.amount - b.amount)[0];
  }, [data]);

  const reportsUrl = '/manager/reports';

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
              color: 'primary.main',
              display: 'flex',
            }}
          >
            <BarChartOutlinedIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Sales by Fuel
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {range.label} · from reconciled shifts
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={period}
            onChange={(_, v: SalesByFuelPeriod | null) => {
              if (v) setPeriod(v);
            }}
            sx={{ '& .MuiToggleButton-root': { px: 1.5, textTransform: 'none', fontWeight: 600 } }}
          >
            <ToggleButton value="daily">Daily</ToggleButton>
            <ToggleButton value="weekly">Weekly</ToggleButton>
            <ToggleButton value="monthly">Monthly</ToggleButton>
          </ToggleButtonGroup>
          <Button
            component={RouterLink}
            to={reportsUrl}
            size="small"
            variant="outlined"
            endIcon={<OpenInNewOutlinedIcon />}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            Full report
          </Button>
        </Stack>
      </Stack>

      {err ? <Alert severity="error">{err}</Alert> : null}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress size={32} />
        </Box>
      ) : data ? (
        <>
          {data.totalAmount <= 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              No reconciled shift sales for this period. Complete shift reconciliation to populate the chart.
            </Alert>
          ) : (
            <>
              <Card
                elevation={0}
                sx={{
                  p: { xs: 2, sm: 2.5 },
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  justifyContent="space-between"
                  sx={{ mb: 2 }}
                >
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Total daily sales
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtChartRs(data.totalAmount)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {fmtChartLiters(data.totalLiters)} · {data.reconciledShiftCount} reconciled shift
                      {data.reconciledShiftCount === 1 ? '' : 's'}
                    </Typography>
                  </Box>
                  {bestSeller && lowestSeller ? (
                    <Stack spacing={0.5} sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                      <Typography variant="body2">
                        Best:{' '}
                        <Box component="span" sx={{ fontWeight: 700, color: fuelBarColor(bestSeller.shortCode, theme) }}>
                          {bestSeller.shortCode}
                        </Box>{' '}
                        ({bestSeller.contributionPercent.toFixed(1)}%)
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Lowest:{' '}
                        <Box component="span" sx={{ fontWeight: 600 }}>
                          {lowestSeller.shortCode}
                        </Box>{' '}
                        ({lowestSeller.contributionPercent.toFixed(1)}%)
                      </Typography>
                    </Stack>
                  ) : null}
                </Stack>

                <Stack direction="row" spacing={{ xs: 1, sm: 2 }} alignItems="flex-end" justifyContent="center">
                  {data.rows.map((row) => (
                    <FuelBar
                      key={row.shortCode}
                      row={row}
                      maxAmount={maxAmount}
                      onSelect={() => {
                        window.location.href = reportsUrl;
                      }}
                    />
                  ))}
                </Stack>
              </Card>

              <TableContainer component={Card} elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={headSx}>Fuel</TableCell>
                      <TableCell sx={headSx} align="right">
                        Sales (₹)
                      </TableCell>
                      <TableCell sx={headSx} align="right">
                        Quantity (L)
                      </TableCell>
                      <TableCell sx={headSx} align="right">
                        Share
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.rows.map((row) => (
                      <TableRow
                        key={row.shortCode}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => {
                          window.location.href = reportsUrl;
                        }}
                      >
                        <TableCell sx={{ fontWeight: 700 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                bgcolor: FUEL_CHART_COLORS[row.shortCode],
                              }}
                            />
                            {row.shortCode}
                          </Stack>
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {fmtChartRs(row.amount)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {fmtChartLiters(row.liters)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                          {row.contributionPercent.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell sx={{ fontWeight: 800 }}>Total</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtChartRs(data.totalAmount)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtChartLiters(data.totalLiters)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        100%
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </>
      ) : null}
    </Stack>
  );
}
