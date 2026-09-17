import { useEffect, useMemo, useState } from 'react';
import {
  alpha,
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  TextField,
  Typography,
} from '@mui/material';
import { FilterToolbar } from '@/components/ui/FilterToolbar';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReadOnlyBanner } from '@/components/ui/ReadOnlyBanner';
import { ResponsiveTableContainer } from '@/components/ui/ResponsiveTableContainer';
import { usePermissions } from '@/hooks/usePermissions';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { listClosedShiftsInEndTimeWindow } from '@/services/shiftsService';
import {
  getDailySalesFuelPivot,
  getMeterRegisterRowsInRange,
  getOperatorPerformanceInRange,
  getPumpAttendantAttendanceRowsInRange,
  type DailySalesPivotRow,
  type MeterRegisterRow,
  type OperatorPerf,
  type PumpAttendantAttendanceRow,
} from '@/services/aggregatesService';
import { listCreditCustomers } from '@/services/creditCustomersService';
import { listAllCreditSales } from '@/services/creditSalesService';
import { listAllCreditPayments } from '@/services/creditPaymentsService';
import { listExpensesInRange, listLedgerInRange } from '@/services/ledgerService';
import { downloadCsv } from '@/utils/csvExport';
import { parsePumpDayParam } from '@/utils/dateEntryPolicy';
import { getDailyFuelStockReport } from '@/services/fuelStockReconciliationService';
import { getReconciliationForShift } from '@/services/reconciliationService';
import {
  getCashBankCollectionDailyRows,
  getCashBankCollectionShiftDetails,
  getCashBankCollectionSummary,
  type CashBankCollectionDailyRow,
  type CashBankCollectionShiftDetailRow,
  type CashBankCollectionSummary,
} from '@/services/collectionSummaryService';
import { CashBankCollectionReportPanel } from '@/pages/manager/CashBankCollectionReportPanel';
import type { DailyFuelStockRow } from '@/types/entities';

function fmtInr(n: number): string {
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function fmtRupeesCell(n: number): string {
  const t = fmtInr(n);
  return `₹ ${t}`;
}

type TabId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function ReportsPage() {
  const { readOnlyOps } = usePermissions();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<TabId>(0);
  const [from, setFrom] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [to, setTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [dailyPivot, setDailyPivot] = useState<DailySalesPivotRow[]>([]);
  const [dailyCredit, setDailyCredit] = useState(0);
  const [dailyExp, setDailyExp] = useState(0);
  const [dailyNet, setDailyNet] = useState(0);
  const [meterRows, setMeterRows] = useState<MeterRegisterRow[]>([]);

  const [op, setOp] = useState<OperatorPerf[]>([]);
  const [creditRows, setCreditRows] = useState<
    { name: string; bal: number; sales: number; pay: number }[]
  >([]);
  const [expRows, setExpRows] = useState<{
    id: string;
    date: string;
    cat: string;
    amt: number;
  }[]>([]);
  const [expTot, setExpTot] = useState<Record<string, number>>({});
  const [custFilter, setCustFilter] = useState('');
  const [attendanceRows, setAttendanceRows] = useState<PumpAttendantAttendanceRow[]>([]);
  const [stockRows, setStockRows] = useState<DailyFuelStockRow[]>([]);
  const [stockReportKind, setStockReportKind] = useState<'daily' | 'tank' | 'variation' | 'monthly'>('daily');
  const [collectionSummary, setCollectionSummary] = useState<CashBankCollectionSummary | null>(null);
  const [collectionDailyRows, setCollectionDailyRows] = useState<CashBankCollectionDailyRow[]>([]);
  const [collectionShiftDetails, setCollectionShiftDetails] = useState<CashBankCollectionShiftDetailRow[]>([]);

  useEffect(() => {
    if (searchParams.get('report') === 'collections') {
      setTab(7);
    }
    const day = parsePumpDayParam(searchParams.get('day'));
    if (day) {
      setFrom(day);
      setTo(day);
    }
  }, [searchParams]);

  const showOtherFuelCol = useMemo(
    () =>
      dailyPivot.some((r) => Math.abs(r.otherLiters) > 0.005 || Math.abs(r.otherAmount) > 0.005),
    [dailyPivot],
  );

  async function run() {
    setErr(null);
    setLoading(true);
    try {
      const a = new Date(from + 'T00:00:00');
      const b = new Date(to + 'T23:59:59.999');
      if (tab === 0) {
        setDailyPivot(await getDailySalesFuelPivot(a, b));
        const closed = await listClosedShiftsInEndTimeWindow(a, b);
        let cr = 0;
        for (const sh of closed) {
          const recon = await getReconciliationForShift(sh.id);
          if (recon) {
            cr += recon.creditAmount;
          }
        }
        setDailyCredit(cr);
        const ex = await listExpensesInRange(a, b);
        const eSum = ex.reduce((s, x) => s + x.amount, 0);
        setDailyExp(eSum);
        const allInc = await listLedgerInRange(a, b, 'income');
        const allEx = await listLedgerInRange(a, b, 'expense');
        const inc = allInc.reduce((s, l) => s + l.amount, 0);
        const ex2 = allEx.reduce((s, l) => s + l.amount, 0);
        setDailyNet(inc - ex2);
      } else if (tab === 1) {
        setMeterRows(await getMeterRegisterRowsInRange(a, b));
      } else if (tab === 2) {
        setOp(await getOperatorPerformanceInRange(a, b));
      } else if (tab === 3) {
        setAttendanceRows(await getPumpAttendantAttendanceRowsInRange(a, b));
      } else if (tab === 4) {
        const [cust, sales, pays] = await Promise.all([
          listCreditCustomers(true),
          listAllCreditSales(),
          listAllCreditPayments(),
        ]);
        const fromMs = a.getTime();
        const toMs = b.getTime();
        const out: { name: string; bal: number; sales: number; pay: number }[] = [];
        for (const c of cust) {
          if (custFilter && !c.name.toLowerCase().includes(custFilter.toLowerCase())) {
            continue;
          }
          const inRangeS = sales
            .filter(
              (s) =>
                s.customerId === c.id && s.date.toMillis() >= fromMs && s.date.toMillis() <= toMs,
            )
            .reduce((a, s) => a + s.amount, 0);
          const inRangeP = pays
            .filter(
              (p) =>
                p.customerId === c.id && p.date.toMillis() >= fromMs && p.date.toMillis() <= toMs,
            )
            .reduce((a, p) => a + p.amountReceived, 0);
          if (inRangeS === 0 && inRangeP === 0) {
            continue;
          }
          const toDateS = sales
            .filter((s) => s.customerId === c.id)
            .reduce((a, s) => a + s.amount, 0);
          const toDateP = pays
            .filter((p) => p.customerId === c.id)
            .reduce((a, p) => a + p.amountReceived, 0);
          out.push({
            name: c.name,
            bal: c.currentBalance,
            sales: toDateS,
            pay: toDateP,
          });
        }
        setCreditRows(out);
      } else if (tab === 5) {
        const ex = await listExpensesInRange(a, b);
        const t: Record<string, number> = {};
        const r = ex.map((e) => {
          t[e.category] = (t[e.category] ?? 0) + e.amount;
          return {
            id: e.id,
            date: format(e.date.toDate(), 'yyyy-MM-dd'),
            cat: e.category,
            amt: e.amount,
          };
        });
        setExpRows(r);
        setExpTot(t);
      } else if (tab === 6) {
        setStockRows(await getDailyFuelStockReport(from, to));
      } else if (tab === 7) {
        const [summary, daily, shifts] = await Promise.all([
          getCashBankCollectionSummary(from, to),
          getCashBankCollectionDailyRows(from, to),
          getCashBankCollectionShiftDetails(from, to),
        ]);
        setCollectionSummary(summary);
        setCollectionDailyRows(daily);
        setCollectionShiftDetails(shifts);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Report failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack spacing={3} sx={{ pb: 4 }}>
      {readOnlyOps ? <ReadOnlyBanner /> : null}
      <PageHeader title="Reports" />

      {err && <Alert severity="error">{err}</Alert>}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.1 : 0.05), px: 1, pt: 0.5 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v as TabId)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 48,
              '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', minHeight: 48 },
            }}
          >
            <Tab label="Daily sales" />
            <Tab label="Meter register" />
            <Tab label="Employee" />
            <Tab label="Pump boys / girls" />
            <Tab label="Credit" />
            <Tab label="Expenses" />
            <Tab label="Fuel stock" />
            <Tab label="Cash & bank" />
          </Tabs>
        </Box>
        <FilterToolbar sx={{ p: 2 }}>
          <TextField
            type="date"
            label="From"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
          />
          <TextField
            type="date"
            label="To"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
          />
          {tab === 4 && (
            <TextField
              size="small"
              label="Customer name filter"
              value={custFilter}
              onChange={(e) => setCustFilter(e.target.value)}
              sx={{ minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
          )}
          {tab === 6 && (
            <TextField
              select
              size="small"
              label="Report type"
              value={stockReportKind}
              onChange={(e) => setStockReportKind(e.target.value as typeof stockReportKind)}
              slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
              sx={{ minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            >
              <option value="daily">Daily dip report</option>
              <option value="tank">Tank stock report</option>
              <option value="variation">Variation report</option>
              <option value="monthly">Monthly reconciliation</option>
            </TextField>
          )}
          <Box sx={{ flex: 1 }} />
          <Chip
            size="small"
            label={loading ? 'Loading…' : 'Ready'}
            color={loading ? 'default' : 'success'}
            variant="outlined"
            sx={{ fontWeight: 600, display: { xs: 'none', sm: 'flex' } }}
          />
          <Button variant="contained" color="secondary" onClick={run} disabled={loading} sx={{ borderRadius: 1.5, px: 2.5, minHeight: 48 }}>
            {loading ? 'Loading…' : 'Run report'}
          </Button>
        </FilterToolbar>
      </Paper>

      {tab === 0 && (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Daily sales
          </Typography>
          <Paper variant="outlined">
            <ResponsiveTableContainer stickyFirstColumn>
            <Table
              size="small"
              sx={{
                borderCollapse: 'collapse',
                minWidth: showOtherFuelCol ? 920 : 800,
                '& th, & td': { border: '1px solid', borderColor: 'divider' },
              }}
            >
              <TableHead>
                <TableRow sx={{ bgcolor: (t) => alpha(t.palette.grey[300], 0.45) }}>
                  <TableCell sx={{ fontWeight: 700 }}>DATE</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    PETROL
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    AMOUNTS
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    DIESEL
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    AMOUNTS2
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    XP
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    AMOUNTS3
                  </TableCell>
                  {showOtherFuelCol ? (
                    <>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        OTHER
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        AMOUNTS4
                      </TableCell>
                    </>
                  ) : null}
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    TOTAL AMOUNTS
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dailyPivot.map((r, idx) => (
                  <TableRow
                    key={r.dateIso}
                    sx={{
                      bgcolor:
                        idx % 2 === 1 ? (t) => alpha(t.palette.grey[500], 0.06) : 'background.paper',
                    }}
                  >
                    <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{r.dateLabel}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {r.petrolLiters.toFixed(2)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fmtRupeesCell(r.petrolAmount)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {r.dieselLiters.toFixed(2)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fmtRupeesCell(r.dieselAmount)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {r.xpLiters.toFixed(2)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {fmtRupeesCell(r.xpAmount)}
                    </TableCell>
                    {showOtherFuelCol ? (
                      <>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {r.otherLiters.toFixed(2)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {fmtRupeesCell(r.otherAmount)}
                        </TableCell>
                      </>
                    ) : null}
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                      {fmtRupeesCell(r.totalAmount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </ResponsiveTableContainer>
          </Paper>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Credit: ₹{dailyCredit.toFixed(2)} · Expenses: ₹{dailyExp.toFixed(2)} · Net: ₹{dailyNet.toFixed(2)}
          </Typography>
          <Button
            size="small"
            sx={{ mt: 1 }}
            onClick={() => {
              const baseCols = [
                'DATE',
                'PETROL_L',
                'AMOUNTS_PETROL_RS',
                'DIESEL_L',
                'AMOUNTS2_DIESEL_RS',
                'XP_L',
                'AMOUNTS3_XP_RS',
              ];
              const extraCols = showOtherFuelCol ? ['OTHER_L', 'AMOUNTS4_OTHER_RS'] : [];
              const tail = ['TOTAL_AMOUNTS_RS'];
              const hdr = [...baseCols, ...extraCols, ...tail];
              const rows = dailyPivot.map((r) => {
                const b = [
                  r.dateLabel,
                  r.petrolLiters,
                  r.petrolAmount,
                  r.dieselLiters,
                  r.dieselAmount,
                  r.xpLiters,
                  r.xpAmount,
                ];
                const o = showOtherFuelCol ? [r.otherLiters, r.otherAmount] : [];
                return [...b, ...o, r.totalAmount];
              });
              downloadCsv('daily_sales_pivot.csv', hdr, rows);
            }}
          >
            Export CSV
          </Button>
        </Box>
      )}

      {tab === 1 && (
        <Box>
          {meterRows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No rows for this range.
            </Typography>
          ) : (
            <>
              <Paper variant="outlined">
                <ResponsiveTableContainer stickyFirstColumn>
                  <Table
                    size="small"
                    sx={{
                      minWidth: 1100,
                      borderCollapse: 'collapse',
                      '& th, & td': { border: '1px solid', borderColor: 'divider' },
                    }}
                  >
                    <TableHead>
                      <TableRow
                        sx={{
                          bgcolor: (t) => alpha(t.palette.grey[300], 0.45),
                          '& th': {
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: 'text.secondary',
                            whiteSpace: 'nowrap',
                          },
                        }}
                      >
                        <TableCell>Date</TableCell>
                        <TableCell align="right">Machine</TableCell>
                        <TableCell align="right">Nozzle</TableCell>
                        <TableCell>Pump boy/girls</TableCell>
                        <TableCell>Time in &amp; out</TableCell>
                        <TableCell>Fuel type</TableCell>
                        <TableCell align="right">Opening</TableCell>
                        <TableCell align="right">Closing</TableCell>
                        <TableCell align="right">Total</TableCell>
                        <TableCell align="right">TAS</TableCell>
                        <TableCell align="right">Sales</TableCell>
                        <TableCell align="right">Rate</TableCell>
                        <TableCell align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {meterRows.map((r, idx) => (
                        <TableRow
                          key={`${r.dateIso}-${r.machine}-${r.nozzle}-${r.timeInOut}-${idx}`}
                          sx={{
                            bgcolor:
                              idx % 2 === 1 ? (t) => alpha(t.palette.grey[500], 0.06) : 'background.paper',
                          }}
                        >
                          <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {r.dateLabel}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.machine}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.nozzle}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 500 }}>{r.pumpBoyGirls}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.timeInOut}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{r.fuelType}</TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.opening.toFixed(2)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.closing.toFixed(2)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.total.toFixed(2)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.tas.toFixed(2)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.sales.toFixed(2)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.rate.toFixed(2)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                            {r.amount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ResponsiveTableContainer>
              </Paper>
              <Button
                size="small"
                sx={{ mt: 1 }}
                onClick={() =>
                  downloadCsv(
                    'meter_register.csv',
                    [
                      'Date',
                      'Machine',
                      'Nozzle',
                      'Pump boy/girls',
                      'Time in & out',
                      'Fuel type',
                      'Opening',
                      'Closing',
                      'Total',
                      'TAS',
                      'Sales',
                      'Rate',
                      'Amount',
                    ],
                    meterRows.map((r) => [
                      r.dateLabel,
                      r.machine,
                      r.nozzle,
                      r.pumpBoyGirls,
                      r.timeInOut,
                      r.fuelType,
                      r.opening,
                      r.closing,
                      r.total,
                      r.tas,
                      r.sales,
                      r.rate,
                      r.amount,
                    ]),
                  )
                }
              >
                Download CSV
              </Button>
            </>
          )}
        </Box>
      )}

      {tab === 2 && (
        <Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Operator</TableCell>
                <TableCell align="right">Liters</TableCell>
                <TableCell align="right">₹</TableCell>
                <TableCell>Short/Over (count)</TableCell>
                <TableCell align="right">Short/Over (sum diff ₹)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {op.map((r) => (
                <TableRow key={r.operatorId}>
                  <TableCell>{r.operatorName}</TableCell>
                  <TableCell align="right">{r.totalLiters.toFixed(2)}</TableCell>
                  <TableCell align="right">{r.totalAmount.toFixed(2)}</TableCell>
                  <TableCell>
                    S {r.shortOverCount.short} / O {r.shortOverCount.over} / ={' '}
                    {r.shortOverCount.zero}
                  </TableCell>
                  <TableCell align="right">{r.shortOverSum.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button
            size="small"
            onClick={() =>
              downloadCsv(
                'employee_perf.csv',
                ['Operator', 'Liters', 'Amount', 'ShortOverSum'],
                op.map((r) => [r.operatorName, r.totalLiters, r.totalAmount, r.shortOverSum]),
              )
            }
          >
            Export
          </Button>
        </Box>
      )}

      {tab === 3 && (
        <Box>
          {attendanceRows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No rows for this range.
            </Typography>
          ) : (
            <>
              <Paper variant="outlined" sx={{ borderRadius: 1 }}>
                <ResponsiveTableContainer stickyFirstColumn>
                <Table size="small" sx={{ minWidth: 820 }}>
                  <TableHead>
                    <TableRow
                      sx={{
                        bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.16 : 0.06),
                        '& th': {
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: 'text.secondary',
                        },
                      }}
                    >
                      <TableCell>Date</TableCell>
                      <TableCell>Pump boy / girl</TableCell>
                      <TableCell>Shift</TableCell>
                      <TableCell>Machine</TableCell>
                      <TableCell>Operator</TableCell>
                      <TableCell>Start</TableCell>
                      <TableCell>End</TableCell>
                      <TableCell>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {attendanceRows.map((r, i) => (
                      <TableRow
                        key={`${r.pumpDayIso}-${r.startAt}-${r.pumpBoyGirl}-${i}`}
                        sx={{
                          '&:nth-of-type(even)': { bgcolor: (t) => alpha(t.palette.action.hover, 0.35) },
                        }}
                      >
                        <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{r.dateLabel}</TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>{r.pumpBoyGirl}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.shiftLabel}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{r.machineLabel}</TableCell>
                        <TableCell>{r.operatorName}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{r.startAt}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{r.endAt}</TableCell>
                        <TableCell sx={{ maxWidth: 280, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                          {r.remarks || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </ResponsiveTableContainer>
              </Paper>
              <Button
                size="small"
                sx={{ mt: 1 }}
                onClick={() =>
                  downloadCsv(
                    'pump_boys_girls_attendants_sheet.csv',
                    [
                      'PumpDay_ISO',
                      'Date_DDMMYYYY',
                      'Pump_boy_girl',
                      'Shift',
                      'Machine',
                      'Operator',
                      'Start_local',
                      'End_local',
                      'Remarks',
                    ],
                    attendanceRows.map((r) => [
                      r.pumpDayIso,
                      r.dateLabel,
                      r.pumpBoyGirl,
                      r.shiftLabel,
                      r.machineLabel,
                      r.operatorName,
                      r.startAt,
                      r.endAt,
                      r.remarks,
                    ]),
                  )
                }
              >
                Export CSV
              </Button>
            </>
          )}
        </Box>
      )}

      {tab === 4 && (
        <Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell align="right">Balance</TableCell>
                <TableCell align="right">Total sales to date</TableCell>
                <TableCell align="right">Total paid to date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {creditRows.map((r) => (
                <TableRow key={r.name + r.bal}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell align="right">{r.bal.toFixed(2)}</TableCell>
                  <TableCell align="right">{r.sales.toFixed(2)}</TableCell>
                  <TableCell align="right">{r.pay.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button
            size="small"
            onClick={() =>
              downloadCsv(
                'credit_report.csv',
                ['Name', 'Balance', 'TotalSales', 'TotalPaid'],
                creditRows.map((r) => [r.name, r.bal, r.sales, r.pay]),
              )
            }
          >
            Export
          </Button>
        </Box>
      )}

      {tab === 5 && (
        <Box>
          <Typography variant="body2" gutterBottom>
            Totals by category:
          </Typography>
          {Object.keys(expTot).map((k) => (
            <Typography key={k} variant="body2">
              {k}: ₹{expTot[k]!.toFixed(2)}
            </Typography>
          ))}
          <Table size="small" sx={{ mt: 1 }}>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.date}</TableCell>
                  <TableCell>{r.cat}</TableCell>
                  <TableCell align="right">{r.amt.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button
            size="small"
            onClick={() =>
              downloadCsv(
                'expense_report.csv',
                ['Date', 'Category', 'Amount'],
                expRows.map((r) => [r.date, r.cat, r.amt]),
              )
            }
          >
            Export
          </Button>
        </Box>
      )}

      {tab === 6 && (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            {stockReportKind === 'daily' && 'Daily dip'}
            {stockReportKind === 'tank' && 'Tank stock'}
            {stockReportKind === 'variation' && 'Variation'}
            {stockReportKind === 'monthly' && 'Monthly stock'}
          </Typography>
          <Paper variant="outlined">
            <ResponsiveTableContainer stickyFirstColumn>
            <Table size="small" sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Fuel</TableCell>
                  <TableCell align="right">Dip (cm)</TableCell>
                  <TableCell align="right">Opening (L)</TableCell>
                  <TableCell align="right">Sales (L)</TableCell>
                  <TableCell align="right">Purchase (L)</TableCell>
                  <TableCell align="right">Expected (L)</TableCell>
                  <TableCell align="right">Actual (L)</TableCell>
                  <TableCell align="right">Variation (L)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stockRows
                  .filter((r) => {
                    if (stockReportKind === 'variation') {
                      return r.variationAlert || !r.dipEnteredToday;
                    }
                    return true;
                  })
                  .map((r) => (
                    <TableRow key={`${r.pumpDayIso}-${r.fuelTypeId}`}>
                      <TableCell>{r.pumpDayIso}</TableCell>
                      <TableCell>{r.shortCode}</TableCell>
                      <TableCell align="right">{r.closingDipCm ?? r.currentDipCm ?? '—'}</TableCell>
                      <TableCell align="right">{r.openingStockLiters.toLocaleString('en-IN')}</TableCell>
                      <TableCell align="right">{r.salesLiters.toLocaleString('en-IN')}</TableCell>
                      <TableCell align="right">{r.receiptLiters.toLocaleString('en-IN')}</TableCell>
                      <TableCell align="right">{r.expectedStockLiters.toLocaleString('en-IN')}</TableCell>
                      <TableCell align="right">
                        {r.actualStockLiters != null ? r.actualStockLiters.toLocaleString('en-IN') : '—'}
                      </TableCell>
                      <TableCell align="right">
                        {r.variationLiters != null ? r.variationLiters.toLocaleString('en-IN') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            </ResponsiveTableContainer>
          </Paper>
          <Button
            size="small"
            sx={{ mt: 1 }}
            onClick={() =>
              downloadCsv(
                `fuel_stock_${stockReportKind}.csv`,
                ['Date', 'Fuel', 'DipCm', 'Opening', 'Sales', 'Purchase', 'Expected', 'Actual', 'Variation'],
                stockRows.map((r) => [
                  r.pumpDayIso,
                  r.shortCode,
                  r.closingDipCm ?? r.currentDipCm ?? '',
                  r.openingStockLiters,
                  r.salesLiters,
                  r.receiptLiters,
                  r.expectedStockLiters,
                  r.actualStockLiters ?? '',
                  r.variationLiters ?? '',
                ]),
              )
            }
          >
            Export CSV
          </Button>
        </Box>
      )}
      {tab === 7 && (
        <CashBankCollectionReportPanel
          fromIso={from}
          toIso={to}
          summary={collectionSummary}
          dailyRows={collectionDailyRows}
          shiftDetails={collectionShiftDetails}
        />
      )}
    </Stack>
  );
}
