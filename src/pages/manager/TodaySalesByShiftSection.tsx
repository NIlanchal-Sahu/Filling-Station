import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import {
  alpha,
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';

import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';

import {
  getTodaySalesByShift,
  type FuelShiftSalesRow,
  type ShiftSalesBucket,
  type TodaySalesByShiftSummary,
} from '@/services/aggregatesService';
import { FUEL_CHART_COLORS } from '@/utils/fuelSalesChartDisplay';
import { SHIFT_SALES_UPDATED_EVENT } from '@/utils/shiftSalesDisplay';

function fmtRs(n: number): string {
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtLiters(n: number): string {
  return `${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`;
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return '0%';
  return `${Math.round((part / whole) * 1000) / 10}%`;
}

function fuelLitersForShift(row: FuelShiftSalesRow, shiftKey: 'shift1' | 'shift2'): number {
  return shiftKey === 'shift1' ? row.shift1Liters : row.shift2Liters;
}

function FuelSoldBreakdown(props: {
  fuelRows: FuelShiftSalesRow[];
  shiftKey?: 'shift1' | 'shift2';
  totalLiters: number;
}) {
  const { fuelRows, shiftKey, totalLiters } = props;
  const codes = ['MS', 'HSD', 'XP'] as const;

  return (
    <Stack spacing={0.75} sx={{ mt: 1.25 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>
        Fuel sold
      </Typography>
      {codes.map((code) => {
        const row = fuelRows.find((r) => r.shortCode === code);
        const liters = row
          ? shiftKey
            ? fuelLitersForShift(row, shiftKey)
            : row.totalLiters
          : 0;
        return (
          <Stack key={code} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={0.75} alignItems="center">
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: FUEL_CHART_COLORS[code], flexShrink: 0 }} />
              <Typography variant="body2" color="text.secondary">
                {code}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {fmtLiters(liters)}
            </Typography>
          </Stack>
        );
      })}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{ pt: 0.75, mt: 0.25, borderTop: '1px dashed', borderColor: 'divider' }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
          Total
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'text.primary' }}>
          {fmtLiters(totalLiters)}
        </Typography>
      </Stack>
    </Stack>
  );
}

function ShiftSalesCard(props: {
  bucket: ShiftSalesBucket;
  fuelRows: FuelShiftSalesRow[];
  sharePct: string;
  isTop: boolean;
  accent: string;
}) {
  const { bucket, fuelRows, sharePct, isTop, accent } = props;
  const detailTo = bucket.shiftId ? `/shifts/${bucket.shiftId}/reconcile?edit=1` : undefined;

  const body = (
    <>
      <Box sx={{ height: 3, bgcolor: accent }} />
      <CardContent sx={{ pt: 2, pb: 2, px: 2.25 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
              {bucket.displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
              {bucket.shiftLabel}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" justifyContent="flex-end">
            <Chip size="small" label={sharePct} variant="outlined" sx={{ height: 22 }} />
            {isTop ? (
              <Chip
                size="small"
                icon={<TrendingUpOutlinedIcon sx={{ fontSize: '14px !important' }} />}
                label="Top shift"
                color="success"
                sx={{ height: 22 }}
              />
            ) : null}
          </Stack>
        </Stack>

        <Typography variant="h5" sx={{ fontWeight: 800, mt: 1.5, fontVariantNumeric: 'tabular-nums' }}>
          {fmtRs(bucket.totalAmount)}
        </Typography>
        <FuelSoldBreakdown fuelRows={fuelRows} shiftKey={bucket.shiftKey} totalLiters={bucket.totalLiters} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
          Transactions:{' '}
          <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
            {bucket.transactionCount.toLocaleString('en-IN')}
          </Box>
        </Typography>
        {detailTo ? (
          <Typography variant="caption" color="primary" sx={{ mt: 1.5, display: 'block' }}>
            Tap for shift report →
          </Typography>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
            No closed shift yet
          </Typography>
        )}
      </CardContent>
    </>
  );

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        borderRadius: 2,
        border: '2px solid',
        borderColor: isTop ? accent : 'divider',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s ease',
        boxShadow: isTop ? `0 4px 16px ${alpha(accent, 0.2)}` : undefined,
      }}
    >
      {detailTo ? (
        <CardActionArea component={RouterLink} to={detailTo} sx={{ height: '100%', alignItems: 'stretch' }}>
          {body}
        </CardActionArea>
      ) : (
        body
      )}
    </Card>
  );
}

function TotalSalesCard(props: {
  totalAmount: number;
  totalLiters: number;
  transactionCount: number;
  fuelRows: FuelShiftSalesRow[];
  accent: string;
}) {
  const { totalAmount, totalLiters, transactionCount, fuelRows, accent } = props;
  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        background: (t) =>
          `linear-gradient(135deg, ${alpha(t.palette.primary.main, 0.06)} 0%, ${alpha(accent, 0.08)} 100%)`,
      }}
    >
      <Box sx={{ height: 3, bgcolor: accent }} />
      <CardContent sx={{ pt: 2, pb: 2, px: 2.25 }}>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
          Today&apos;s total
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800, mt: 1.5, fontVariantNumeric: 'tabular-nums', color: 'primary.main' }}>
          {fmtRs(totalAmount)}
        </Typography>
        <FuelSoldBreakdown fuelRows={fuelRows} totalLiters={totalLiters} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
          Transactions:{' '}
          <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
            {transactionCount.toLocaleString('en-IN')}
          </Box>
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
          Shift 1 + Shift 2 (+ night shift if closed)
        </Typography>
      </CardContent>
    </Card>
  );
}

export function TodaySalesByShiftSection(props: { pumpDayIso: string; reportLabel?: string }) {
  const theme = useTheme();
  const { pumpDayIso } = props;
  const [summary, setSummary] = useState<TodaySalesByShiftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const day = new Date(`${pumpDayIso}T12:00:00`);
      setSummary(await getTodaySalesByShift(day));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load shift sales');
    } finally {
      setLoading(false);
    }
  }, [pumpDayIso]);

  useEffect(() => {
    setLoading(true);
    void load();
    const onRefresh = () => void load();
    window.addEventListener(SHIFT_SALES_UPDATED_EVENT, onRefresh);
    window.addEventListener('focus', onRefresh);
    return () => {
      window.removeEventListener(SHIFT_SALES_UPDATED_EVENT, onRefresh);
      window.removeEventListener('focus', onRefresh);
    };
  }, [load]);

  const topShift = useMemo<'shift1' | 'shift2' | null>(() => {
    if (!summary) return null;
    const { shift1, shift2 } = summary;
    if (shift1.totalAmount <= 0 && shift2.totalAmount <= 0) return null;
    if (shift1.totalAmount === shift2.totalAmount) return null;
    return shift1.totalAmount > shift2.totalAmount ? 'shift1' : 'shift2';
  }, [summary]);

  const shift1Pct = summary ? pct(summary.shift1.totalAmount, summary.todayTotal.totalAmount) : '0%';
  const shift2Pct = summary ? pct(summary.shift2.totalAmount, summary.todayTotal.totalAmount) : '0%';

  return (
    <Stack spacing={2}>
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
          <CircularProgress size={32} />
        </Card>
      ) : summary ? (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          }}
        >
          <ShiftSalesCard
            bucket={summary.shift1}
            fuelRows={summary.fuelRows}
            sharePct={shift1Pct}
            isTop={topShift === 'shift1'}
            accent={theme.palette.success.main}
          />
          <ShiftSalesCard
            bucket={summary.shift2}
            fuelRows={summary.fuelRows}
            sharePct={shift2Pct}
            isTop={topShift === 'shift2'}
            accent={theme.palette.info.main}
          />
          <TotalSalesCard
            totalAmount={summary.todayTotal.totalAmount}
            totalLiters={summary.todayTotal.totalLiters}
            transactionCount={summary.todayTotal.transactionCount}
            fuelRows={summary.fuelRows}
            accent={theme.palette.primary.main}
          />
        </Box>
      ) : null}
    </Stack>
  );
}
