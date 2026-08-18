import { useMemo } from 'react';

import {
  alpha,
  Alert,
  Box,
  Button,
  Card,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';

import type {
  CashBankCollectionDailyRow,
  CashBankCollectionShiftDetailRow,
  CashBankCollectionSummary,
  CollectionModeKey,
} from '@/services/collectionSummaryService';
import { COLLECTION_MODE_COLORS } from '@/utils/collectionSummaryConstants';
import { downloadCsv } from '@/utils/csvExport';

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

function buildDonutGradient(percents: Record<CollectionModeKey, number>): string {
  const order: CollectionModeKey[] = ['cash', 'upi', 'card', 'credit', 'fleet'];
  let cursor = 0;
  const parts: string[] = [];

  for (const key of order) {
    const pct = percents[key];
    if (pct <= 0) continue;
    const end = cursor + pct * 3.6;
    parts.push(`${COLLECTION_MODE_COLORS[key]} ${cursor}deg ${end}deg`);
    cursor = end;
  }

  if (parts.length === 0) return 'conic-gradient(#bdbdbd 0deg 360deg)';
  return `conic-gradient(${parts.join(', ')})`;
}

const MODE_LABELS: Record<CollectionModeKey, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  credit: 'Credit',
  fleet: 'Fleet',
};

function CollectionDonut(props: { summary: CashBankCollectionSummary }) {
  const { summary } = props;
  const gradient = useMemo(() => buildDonutGradient(summary.donutPercents), [summary.donutPercents]);

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center" justifyContent="center">
      <Box sx={{ position: 'relative', width: 160, height: 160, flexShrink: 0 }}>
        <Box sx={{ width: '100%', height: '100%', borderRadius: '50%', background: gradient }} />
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
            {fmtRs(summary.totalCollection)}
          </Typography>
        </Box>
      </Box>
      <Stack spacing={1} sx={{ minWidth: 160 }}>
        {(['cash', 'upi', 'card', 'credit', 'fleet'] as CollectionModeKey[]).map((key) => (
          <Stack key={key} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: COLLECTION_MODE_COLORS[key] }} />
              <Typography variant="body2">{MODE_LABELS[key]}</Typography>
            </Stack>
            <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {summary.donutPercents[key].toFixed(1)}%
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

export function CashBankCollectionReportPanel(props: {
  fromIso: string;
  toIso: string;
  summary: CashBankCollectionSummary | null;
  dailyRows: CashBankCollectionDailyRow[];
  shiftDetails: CashBankCollectionShiftDetailRow[];
}) {
  const { fromIso, toIso, summary, dailyRows, shiftDetails } = props;

  if (!summary) {
    return (
      <Typography variant="body2" color="text.secondary">
        Run the report to load cash &amp; bank collection data.
      </Typography>
    );
  }

  const hasData = summary.reconciledShiftCount > 0 || dailyRows.some((r) => r.reconciledShiftCount > 0);

  function exportCsv() {
    const periodLabel = fromIso === toIso ? fromIso : `${fromIso}_to_${toIso}`;

    downloadCsv(
      `cash_bank_collection_summary_${periodLabel}.csv`,
      ['Metric', 'Value'],
      [
        ['From', fromIso],
        ['To', toIso],
        ['Total sales', summary!.totalSales],
        ['Total collection', summary!.totalCollection],
        ['Credit sales (period)', summary!.creditSalesInPeriod],
        ['Credit outstanding', summary!.creditOutstanding],
        ['Collection efficiency %', summary!.collectionEfficiencyPercent],
        ['Cash amount', summary!.cash.amount],
        ['Cash transactions', summary!.cash.transactionCount],
        ['UPI amount', summary!.upi.amount],
        ['UPI transactions', summary!.upi.transactionCount],
        ['Card amount', summary!.card.amount],
        ['Card transactions', summary!.card.transactionCount],
        ['Credit amount', summary!.credit.amount],
        ['Credit transactions', summary!.credit.transactionCount],
        ['Fleet amount', summary!.fleet.amount],
        ['Fleet transactions', summary!.fleet.transactionCount],
      ],
    );

    downloadCsv(
      `cash_bank_collection_shiftwise_${periodLabel}.csv`,
      ['Payment mode', 'Shift 1', 'Shift 2', 'Total'],
      summary!.shiftRows.map((r) => [r.mode, r.shift1, r.shift2, r.total]),
    );

    downloadCsv(
      `cash_bank_collection_daily_${periodLabel}.csv`,
      [
        'Pump day',
        'Date',
        'Cash',
        'UPI',
        'Card',
        'Credit',
        'Fleet',
        'Total collection',
        'Total sales',
        'Collection efficiency %',
        'Reconciled shifts',
      ],
      dailyRows.map((r) => [
        r.pumpDayIso,
        r.dateLabel,
        r.cash,
        r.upi,
        r.card,
        r.credit,
        r.fleet,
        r.totalCollection,
        r.totalSales,
        r.collectionEfficiencyPercent,
        r.reconciledShiftCount,
      ]),
    );

    downloadCsv(
      `cash_bank_collection_shifts_${periodLabel}.csv`,
      [
        'Pump day',
        'Date',
        'Shift',
        'Operator',
        'Cash',
        'UPI',
        'Card',
        'Credit',
        'Fleet',
        'Total collection',
        'Total sales',
        'Recon status',
      ],
      shiftDetails.map((r) => [
        r.pumpDayIso,
        r.dateLabel,
        r.shiftLabel,
        r.operatorName,
        r.cash,
        r.upi,
        r.card,
        r.credit,
        r.fleet,
        r.totalCollection,
        r.totalSales,
        r.reconStatus,
      ]),
    );
  }

  return (
    <Stack spacing={2.5}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        Cash &amp; Bank Collection Summary
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 900, lineHeight: 1.7 }}>
        Collections from reconciled shifts grouped by pump business day ({fromIso}
        {fromIso !== toIso ? ` – ${toIso}` : ''}). Total collection = Cash + UPI + Card + Fleet. Total sales =
        Total collection + Credit sales.
      </Typography>

      {summary.alerts.length ? (
        <Stack spacing={1}>
          {summary.alerts.map((msg) => (
            <Alert key={msg} severity="warning" icon={<WarningAmberOutlinedIcon />} sx={{ borderRadius: 2 }}>
              {msg}
            </Alert>
          ))}
        </Stack>
      ) : null}

      {!hasData ? (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No reconciled collections in this period. Complete shift reconciliation to populate the report.
        </Alert>
      ) : (
        <>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, 1fr)' },
            }}
          >
            {(['cash', 'upi', 'card', 'credit', 'fleet'] as CollectionModeKey[]).map((key) => (
              <Card
                key={key}
                elevation={0}
                sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
              >
                <Box sx={{ width: '100%', height: 3, bgcolor: COLLECTION_MODE_COLORS[key], borderRadius: 1, mb: 1.5 }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  {MODE_LABELS[key]}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', mt: 0.5 }}>
                  {fmtRs(summary[key].amount)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {summary[key].transactionCount} txn
                </Typography>
              </Card>
            ))}
          </Box>

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
                  {fmtRs(summary.totalSales)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Collected Amount
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'success.main' }}>
                  {fmtRs(summary.totalCollection)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Credit Outstanding
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'error.main' }}>
                  {fmtRs(summary.creditOutstanding)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Collection Efficiency
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  {summary.collectionEfficiencyPercent.toFixed(2)}%
                </Typography>
              </Box>
            </Box>
          </Card>

          <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
              Collection breakdown
            </Typography>
            <CollectionDonut summary={summary} />
          </Paper>

          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, p: 2, pb: 0 }}>
              Shift-wise collection (period total)
            </Typography>
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
                {summary.shiftRows.map((row) => (
                  <TableRow key={row.key}>
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
              </TableBody>
            </Table>
          </TableContainer>

          <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, p: 2, pb: 0 }}>
              Daily collection by pump day
            </Typography>
            <Table size="small" sx={{ minWidth: 880 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={headSx}>Date</TableCell>
                  <TableCell sx={headSx} align="right">
                    Cash
                  </TableCell>
                  <TableCell sx={headSx} align="right">
                    UPI
                  </TableCell>
                  <TableCell sx={headSx} align="right">
                    Card
                  </TableCell>
                  <TableCell sx={headSx} align="right">
                    Credit
                  </TableCell>
                  <TableCell sx={headSx} align="right">
                    Fleet
                  </TableCell>
                  <TableCell sx={headSx} align="right">
                    Collected
                  </TableCell>
                  <TableCell sx={headSx} align="right">
                    Total Sales
                  </TableCell>
                  <TableCell sx={headSx} align="right">
                    Efficiency
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dailyRows.map((r) => (
                  <TableRow
                    key={r.pumpDayIso}
                    sx={{
                      bgcolor: r.reconciledShiftCount === 0 ? (t) => alpha(t.palette.action.hover, 0.35) : undefined,
                    }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{r.dateLabel}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fmtRs(r.cash)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fmtRs(r.upi)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fmtRs(r.card)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fmtRs(r.credit)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fmtRs(r.fleet)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                      {fmtRs(r.totalCollection)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fmtRs(r.totalSales)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {r.collectionEfficiencyPercent.toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 800 }}>Total</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtRs(summary.cash.amount)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtRs(summary.upi.amount)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtRs(summary.card.amount)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtRs(summary.credit.amount)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtRs(summary.fleet.amount)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtRs(summary.totalCollection)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtRs(summary.totalSales)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {summary.collectionEfficiencyPercent.toFixed(2)}%
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          {shiftDetails.length > 0 ? (
            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, p: 2, pb: 0 }}>
                Shift detail
              </Typography>
              <Table size="small" sx={{ minWidth: 960 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={headSx}>Date</TableCell>
                    <TableCell sx={headSx}>Shift</TableCell>
                    <TableCell sx={headSx}>Operator</TableCell>
                    <TableCell sx={headSx} align="right">
                      Cash
                    </TableCell>
                    <TableCell sx={headSx} align="right">
                      UPI
                    </TableCell>
                    <TableCell sx={headSx} align="right">
                      Card
                    </TableCell>
                    <TableCell sx={headSx} align="right">
                      Credit
                    </TableCell>
                    <TableCell sx={headSx} align="right">
                      Fleet
                    </TableCell>
                    <TableCell sx={headSx} align="right">
                      Collected
                    </TableCell>
                    <TableCell sx={headSx}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shiftDetails.map((r, i) => (
                    <TableRow key={`${r.pumpDayIso}-${r.shiftLabel}-${i}`}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.dateLabel}</TableCell>
                      <TableCell>{r.shiftLabel}</TableCell>
                      <TableCell>{r.operatorName}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fmtRs(r.cash)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fmtRs(r.upi)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fmtRs(r.card)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fmtRs(r.credit)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fmtRs(r.fleet)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                        {fmtRs(r.totalCollection)}
                      </TableCell>
                      <TableCell>{r.reconStatus}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}
        </>
      )}

      <Button size="small" variant="outlined" onClick={exportCsv} disabled={!hasData} sx={{ alignSelf: 'flex-start' }}>
        Export CSV (summary + daily + shift detail)
      </Button>
    </Stack>
  );
}
