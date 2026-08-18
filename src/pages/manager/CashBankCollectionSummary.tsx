import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import {
  alpha,
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
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
} from '@mui/material';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import DirectionsCarFilledOutlinedIcon from '@mui/icons-material/DirectionsCarFilledOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';

import {
  getCashBankCollectionSummary,
  type CashBankCollectionSummary,
  type CollectionModeKey,
  type PaymentBucket,
} from '@/services/collectionSummaryService';
import {
  COLLECTION_MODE_COLORS,
} from '@/utils/collectionSummaryConstants';
import { resolveSalesByFuelRange, type SalesByFuelPeriod } from '@/utils/fuelSalesChartDisplay';
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

function fmtRs(n: number): string {
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MODE_LINKS: Record<CollectionModeKey, string> = {
  cash: '/manager/daily-sheet',
  upi: '/manager/reconciliations',
  card: '/manager/reconciliations',
  credit: '/manager/credit',
  fleet: '/manager/reconciliations',
};

const MODE_META: Record<
  CollectionModeKey,
  { title: string; subtitle: string; icon: React.ReactNode; accent: string }
> = {
  cash: {
    title: 'Cash Collection',
    subtitle: 'Total cash received',
    icon: <PaymentsOutlinedIcon />,
    accent: COLLECTION_MODE_COLORS.cash,
  },
  upi: {
    title: 'UPI Collection',
    subtitle: 'Total UPI received',
    icon: <QrCode2OutlinedIcon />,
    accent: COLLECTION_MODE_COLORS.upi,
  },
  card: {
    title: 'Card Collection',
    subtitle: 'Total card payments',
    icon: <CreditCardOutlinedIcon />,
    accent: COLLECTION_MODE_COLORS.card,
  },
  credit: {
    title: 'Credit Sales',
    subtitle: 'Total credit amount',
    icon: <AccountBalanceWalletOutlinedIcon />,
    accent: COLLECTION_MODE_COLORS.credit,
  },
  fleet: {
    title: 'Fleet / Loyalty',
    subtitle: 'Total fleet card collection',
    icon: <DirectionsCarFilledOutlinedIcon />,
    accent: COLLECTION_MODE_COLORS.fleet,
  },
};

function CollectionModeCard(props: { mode: CollectionModeKey; bucket: PaymentBucket; loading?: boolean }) {
  const { mode, bucket, loading } = props;
  const meta = MODE_META[mode];

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s ease',
        '&:hover': { boxShadow: (t) => `0 8px 24px ${alpha(t.palette.common.black, 0.08)}` },
      }}
    >
      <CardActionArea component={RouterLink} to={MODE_LINKS[mode]} sx={{ height: '100%', alignItems: 'stretch' }}>
        <Box sx={{ height: 3, bgcolor: meta.accent }} />
        <CardContent sx={{ pt: 2, pb: 2, px: 2.25 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                {meta.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                {meta.subtitle}
              </Typography>
            </Box>
            <Box
              sx={{
                flexShrink: 0,
                p: 1,
                borderRadius: 2,
                bgcolor: (t) => alpha(meta.accent, t.palette.mode === 'dark' ? 0.2 : 0.12),
                color: meta.accent,
                display: 'flex',
              }}
            >
              {meta.icon}
            </Box>
          </Stack>
          {loading ? (
            <CircularProgress size={24} sx={{ mt: 2 }} />
          ) : (
            <>
              <Typography variant="h5" sx={{ fontWeight: 800, mt: 1.5, fontVariantNumeric: 'tabular-nums' }}>
                {fmtRs(bucket.amount)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {bucket.transactionCount} transaction{bucket.transactionCount === 1 ? '' : 's'}
              </Typography>
            </>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function buildDonutGradient(percents: Record<CollectionModeKey, number>): string {
  const order: CollectionModeKey[] = ['cash', 'upi', 'card', 'credit', 'fleet'];
  let cursor = 0;
  const parts: string[] = [];

  for (const key of order) {
    const pct = percents[key];
    if (pct <= 0) continue;
    const deg = pct * 3.6;
    const end = cursor + deg;
    parts.push(`${COLLECTION_MODE_COLORS[key]} ${cursor}deg ${end}deg`);
    cursor = end;
  }

  if (parts.length === 0) {
    return 'conic-gradient(#bdbdbd 0deg 360deg)';
  }
  return `conic-gradient(${parts.join(', ')})`;
}

function CollectionDonut(props: { data: CashBankCollectionSummary }) {
  const { data } = props;
  const gradient = useMemo(() => buildDonutGradient(data.donutPercents), [data.donutPercents]);

  const legend = (
    ['cash', 'upi', 'card', 'credit', 'fleet'] as CollectionModeKey[]
  ).map((key) => ({
    key,
    label: MODE_META[key].title.replace(' Collection', '').replace(' Sales', ''),
    pct: data.donutPercents[key],
    color: COLLECTION_MODE_COLORS[key],
  }));

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center" justifyContent="center">
      <Box sx={{ position: 'relative', width: 160, height: 160, flexShrink: 0 }}>
        <Box
          sx={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: gradient,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: '22%',
            borderRadius: '50%',
            bgcolor: 'background.paper',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            textAlign: 'center',
            px: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Collected
          </Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {fmtRs(data.totalCollection)}
          </Typography>
        </Box>
      </Box>
      <Stack spacing={1} sx={{ minWidth: 160 }}>
        {legend.map((item) => (
          <Stack key={item.key} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: item.color }} />
              <Typography variant="body2">{item.label}</Typography>
            </Stack>
            <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {item.pct.toFixed(1)}%
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

export function CashBankCollectionSummary(props: { pumpDayIso: string }) {
  const navigate = useNavigate();
  const { pumpDayIso } = props;
  const [period, setPeriod] = useState<SalesByFuelPeriod>('daily');
  const [data, setData] = useState<CashBankCollectionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const range = useMemo(() => resolveSalesByFuelRange(pumpDayIso, period), [pumpDayIso, period]);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setData(await getCashBankCollectionSummary(range.fromIso, range.toIso));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load collection summary');
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

  const hasData = data && (data.totalSales > 0 || data.reconciledShiftCount > 0);

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ sm: 'center' }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            💰 Cash &amp; Bank Collection Summary
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {range.label} · collections categorized by payment method
          </Typography>
        </Box>
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
            <ToggleButton value="daily">Today</ToggleButton>
            <ToggleButton value="weekly">Week</ToggleButton>
            <ToggleButton value="monthly">Month</ToggleButton>
          </ToggleButtonGroup>
          <Button
            component={RouterLink}
            to={`/manager/reports?report=collections`}
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

      {data?.alerts.length ? (
        <Stack spacing={1}>
          {data.alerts.map((msg) => (
            <Alert key={msg} severity="warning" icon={<WarningAmberOutlinedIcon />} sx={{ borderRadius: 2 }}>
              {msg}
            </Alert>
          ))}
        </Stack>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)',
            xl: 'repeat(5, 1fr)',
          },
        }}
      >
        {(['cash', 'upi', 'card', 'credit', 'fleet'] as CollectionModeKey[]).map((mode) => (
          <CollectionModeCard
            key={mode}
            mode={mode}
            bucket={data?.[mode] ?? { amount: 0, transactionCount: 0 }}
            loading={loading}
          />
        ))}
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} />
        </Box>
      ) : data && hasData ? (
        <>
          <Card
            elevation={0}
            sx={{
              p: { xs: 2, sm: 2.5 },
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.08 : 0.04),
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total Sales
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  {fmtRs(data.totalSales)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Collected Amount
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'success.main' }}>
                  {fmtRs(data.totalCollection)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Credit Outstanding
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'error.main' }}>
                  {fmtRs(data.creditOutstanding)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Collection Efficiency
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  {data.collectionEfficiencyPercent.toFixed(2)}%
                </Typography>
              </Box>
            </Box>
          </Card>

          <Card
            elevation={0}
            sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
              Collection breakdown
            </Typography>
            <CollectionDonut data={data} />
          </Card>

          <TableContainer component={Card} elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={headSx}>Payment Mode</TableCell>
                  <TableCell sx={headSx} align="right">
                    Shift 1
                  </TableCell>
                  <TableCell sx={headSx} align="right">
                    Shift 2
                  </TableCell>
                  <TableCell sx={headSx} align="right">
                    Total
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.shiftRows.map((row) => (
                  <TableRow
                    key={row.key}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(MODE_LINKS[row.key])}
                  >
                    <TableCell sx={{ fontWeight: 600 }}>{row.mode}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fmtRs(row.shift1)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fmtRs(row.shift2)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtRs(row.total)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 800 }}>Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtRs(data.shiftRows.reduce((s, r) => s + r.shift1, 0))}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtRs(data.shiftRows.reduce((s, r) => s + r.shift2, 0))}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtRs(data.totalCollection + data.creditSalesInPeriod)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </>
      ) : !loading ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No reconciled collections for this period. Complete shift reconciliation to populate this summary.
        </Alert>
      ) : null}
    </Stack>
  );
}
