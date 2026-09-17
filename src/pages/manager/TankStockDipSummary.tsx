import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { format } from 'date-fns';

import {
  alpha,
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import OpacityOutlinedIcon from '@mui/icons-material/OpacityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';

import { getTankStockDaySummary } from '@/services/fuelStockReconciliationService';
import { formatFuelLiters, formatFuelPercent } from '@/services/fuelStockService';
import type { DailyFuelStockRow, TankStockDaySummary } from '@/types/entities';
import {
  FUEL_STOCK_UPDATED_EVENT,
  fuelStockHealthColor,
  fuelStockHealthEmoji,
  fuelStockHealthLabel,
} from '@/utils/fuelStockDisplay';
import { formatDipCm } from '@/utils/fuelTankCalibration';
import { VARIATION_ALERT_LITERS } from '@/utils/fuelStockConstants';
import { downloadCsv } from '@/utils/csvExport';

const headSx = {
  fontWeight: 700,
  fontSize: '0.68rem',
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  bgcolor: 'action.hover',
  color: 'text.secondary',
  whiteSpace: 'nowrap',
  borderBottom: '2px solid',
  borderColor: 'divider',
};

const cellSx = {
  fontVariantNumeric: 'tabular-nums' as const,
  borderBottom: '1px solid',
  borderColor: 'divider',
  py: 1.25,
};

function VariationChip(props: { row: DailyFuelStockRow }) {
  const { row } = props;
  if (row.variationLiters == null) {
    return <Chip size="small" label="Pending dip" variant="outlined" />;
  }
  const label = `${row.variationLiters > 0 ? '+' : ''}${row.variationLiters.toLocaleString('en-IN')} L`;
  if (row.variationAlert) {
    return <Chip size="small" color="error" label={label} />;
  }
  return <Chip size="small" color="success" variant="outlined" label={label} />;
}

function StockBar(props: { row: DailyFuelStockRow }) {
  const { row } = props;
  const theme = useTheme();
  const color = fuelStockHealthColor(row.health, theme);
  return (
    <LinearProgress
      variant="determinate"
      value={row.availablePercent}
      sx={{
        height: 8,
        borderRadius: 999,
        bgcolor: alpha(theme.palette.divider, 0.35),
        '& .MuiLinearProgress-bar': { borderRadius: 999, bgcolor: color, transition: 'transform 0.6s ease' },
      }}
    />
  );
}

function exportTankStockSummary(summary: TankStockDaySummary): void {
  downloadCsv(
    `tank_stock_summary_${summary.pumpDayIso}.csv`,
    [
      'Date',
      'Fuel',
      'OpeningDipCm',
      'OpeningStockL',
      'ReceiptsL',
      'TotalStockL',
      'SalesL',
      'ExpectedClosingStockL',
      'ClosingDipCm',
      'ActualClosingStockL',
      'VariationL',
      'FillPct',
      'Status',
    ],
    summary.rows.map((r) => [
      summary.pumpDayIso,
      r.shortCode,
      r.openingDipCm ?? '',
      r.openingStockLiters,
      r.receiptLiters,
      Math.round(r.openingStockLiters + r.receiptLiters),
      r.salesLiters,
      r.expectedStockLiters,
      r.closingDipCm ?? '',
      r.actualStockLiters ?? '',
      r.variationLiters ?? '',
      Math.round(r.availablePercent * 10) / 10,
      fuelStockHealthLabel(r.health),
    ]),
  );
}

function GroupedAlerts(props: { summary: TankStockDaySummary }) {
  const { summary } = props;
  const todayIso = format(new Date(), 'yyyy-MM-dd');

  const missingDip = summary.rows
    .filter((r) => summary.pumpDayIso === todayIso && !r.dipEnteredToday)
    .map((r) => r.shortCode);
  const lowStock = summary.rows.filter((r) => r.lowStockAlert).map((r) => r.shortCode);
  const highVariation = summary.rows
    .filter((r) => r.variationAlert && r.variationLiters != null)
    .map((r) => r.shortCode);

  if (missingDip.length === 0 && lowStock.length === 0 && highVariation.length === 0) {
    return null;
  }

  return (
    <Alert
      severity="warning"
      icon={<WarningAmberOutlinedIcon fontSize="inherit" />}
      sx={{ borderRadius: 2, py: 0.5, '& .MuiAlert-message': { width: '100%' } }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
        Action needed
      </Typography>
      <Stack spacing={0.25}>
        {missingDip.length > 0 ? (
          <Typography variant="body2">
            Missing closing dip:{' '}
            {missingDip.map((code) => (
              <Box component="span" key={code} sx={{ fontWeight: 700, mr: 0.5 }}>
                {code}
              </Box>
            ))}
          </Typography>
        ) : null}
        {lowStock.length > 0 ? (
          <Typography variant="body2">
            At or below reserve:{' '}
            {lowStock.map((code) => (
              <Box component="span" key={code} sx={{ fontWeight: 700, mr: 0.5 }}>
                {code}
              </Box>
            ))}
          </Typography>
        ) : null}
        {highVariation.length > 0 ? (
          <Typography variant="body2">
            Variation exceeds ±{VARIATION_ALERT_LITERS} L:{' '}
            {highVariation.map((code) => (
              <Box component="span" key={code} sx={{ fontWeight: 700, mr: 0.5 }}>
                {code}
              </Box>
            ))}
          </Typography>
        ) : null}
      </Stack>
    </Alert>
  );
}

export function TankStockDipSummary(props: { pumpDayIso: string; reportLabel?: string }) {
  const { pumpDayIso, reportLabel } = props;
  const [summary, setSummary] = useState<TankStockDaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const todayIso = format(new Date(), 'yyyy-MM-dd');
  const dateChipLabel =
    reportLabel ?? (pumpDayIso === todayIso ? `Today · ${pumpDayIso}` : pumpDayIso);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      setSummary(await getTankStockDaySummary(pumpDayIso));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load tank stock');
    } finally {
      setLoading(false);
    }
  }, [pumpDayIso]);

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

  const hasRows = useMemo(() => (summary?.rows.length ?? 0) > 0, [summary]);

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
            <OpacityOutlinedIcon fontSize="small" />
          </Box>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Tank Stock &amp; Dip Summary
              </Typography>
              <Chip label={dateChipLabel} size="small" variant="outlined" sx={{ height: 22 }} />
            </Stack>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ flexShrink: 0, alignSelf: { xs: 'flex-start', sm: 'center' } }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadOutlinedIcon />}
            disabled={!hasRows || loading}
            onClick={() => summary && exportTankStockSummary(summary)}
            sx={{ borderRadius: 2 }}
          >
            Download CSV
          </Button>
          <Button
            component={RouterLink}
            to={`/manager/fuel-stock/purchase?day=${encodeURIComponent(pumpDayIso)}`}
            variant="outlined"
            size="small"
            startIcon={<LocalGasStationOutlinedIcon />}
            sx={{ borderRadius: 2 }}
          >
            Record purchase
          </Button>
          <Button
            component={RouterLink}
            to={`/manager/fuel-stock/daily?day=${encodeURIComponent(pumpDayIso)}`}
            variant="outlined"
            size="small"
            startIcon={<EditOutlinedIcon />}
            sx={{ borderRadius: 2 }}
          >
            Daily dip entry
          </Button>
        </Stack>
      </Stack>

      {err ? <Alert severity="error">{err}</Alert> : null}

      {loading ? (
        <Card
          elevation={0}
          sx={{
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            py: 5,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <CircularProgress size={36} />
        </Card>
      ) : !hasRows ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No tank stock configured.
        </Alert>
      ) : (
        <>
          {summary ? <GroupedAlerts summary={summary} /> : null}

          <Card elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table
                size="small"
                sx={{
                  minWidth: 1100,
                  borderCollapse: 'collapse',
                  '& .MuiTableCell-root': {
                    borderRight: '1px solid',
                    borderColor: 'divider',
                    '&:last-child': { borderRight: 'none' },
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell sx={headSx}>Fuel</TableCell>
                    <TableCell sx={headSx} align="right">Opening Dip (CM)</TableCell>
                    <TableCell sx={headSx} align="right">Opening Stock (L)</TableCell>
                    <TableCell sx={headSx} align="right">Receipts (L)</TableCell>
                    <TableCell sx={headSx} align="right">Total Stock (L)</TableCell>
                    <TableCell sx={headSx} align="right">Sales (L)</TableCell>
                    <TableCell sx={headSx} align="right">Expected Closing Stock (L)</TableCell>
                    <TableCell sx={headSx} align="right">Closing Dip (CM)</TableCell>
                    <TableCell sx={headSx} align="right">Actual Closing Stock (L)</TableCell>
                    <TableCell sx={headSx} align="right">Variation (L)</TableCell>
                    <TableCell sx={headSx}>Fill %</TableCell>
                    <TableCell sx={headSx}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summary?.rows.map((row) => {
                    const totalStockLiters = Math.round(row.openingStockLiters + row.receiptLiters);
                    return (
                    <TableRow
                      key={row.fuelTypeId}
                      hover
                      sx={{
                        cursor: 'pointer',
                        '&:last-child td': { borderBottom: 'none' },
                      }}
                      onClick={() => {
                        window.location.href = `/manager/fuel-stock/${row.fuelTypeId}`;
                      }}
                    >
                      <TableCell sx={cellSx}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {row.shortCode}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={cellSx}>
                        {row.openingDipCm != null ? formatDipCm(row.openingDipCm) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={cellSx}>
                        {formatFuelLiters(row.openingStockLiters)}
                      </TableCell>
                      <TableCell align="right" sx={cellSx}>
                        {formatFuelLiters(row.receiptLiters)}
                      </TableCell>
                      <TableCell align="right" sx={cellSx}>
                        {formatFuelLiters(totalStockLiters)}
                      </TableCell>
                      <TableCell align="right" sx={cellSx}>
                        {formatFuelLiters(row.salesLiters)}
                      </TableCell>
                      <TableCell align="right" sx={cellSx}>
                        {formatFuelLiters(row.expectedStockLiters)}
                      </TableCell>
                      <TableCell align="right" sx={cellSx}>
                        {row.closingDipCm != null ? formatDipCm(row.closingDipCm) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ ...cellSx, fontWeight: 600 }}>
                        {row.actualStockLiters != null ? formatFuelLiters(row.actualStockLiters) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={cellSx}>
                        <VariationChip row={row} />
                      </TableCell>
                      <TableCell sx={{ ...cellSx, minWidth: 120 }}>
                        <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatFuelPercent(row.availablePercent)}
                        </Typography>
                        <StockBar row={row} />
                      </TableCell>
                      <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap' }}>
                        {fuelStockHealthEmoji(row.health)} {fuelStockHealthLabel(row.health)}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </>
      )}
    </Stack>
  );
}
