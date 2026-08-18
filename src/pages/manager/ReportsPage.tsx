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
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  TextField,
  Typography,
} from '@mui/material';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { listClosedShiftsInEndTimeWindow } from '@/services/shiftsService';
import {
  getDailySalesFuelPivot,
  getOperatorPerformanceInRange,
  getPumpAttendantAttendanceRowsInRange,
  type DailySalesPivotRow,
  type OperatorPerf,
  type PumpAttendantAttendanceRow,
} from '@/services/aggregatesService';
import { listCreditCustomers } from '@/services/creditCustomersService';
import { listAllCreditSales } from '@/services/creditSalesService';
import { listAllCreditPayments } from '@/services/creditPaymentsService';
import { listExpensesInRange, listLedgerInRange } from '@/services/ledgerService';
import { downloadCsv } from '@/utils/csvExport';
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

type TabId = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function ReportsPage() {
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
      setTab(6);
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
        setOp(await getOperatorPerformanceInRange(a, b));
      } else if (tab === 2) {
        setAttendanceRows(await getPumpAttendantAttendanceRowsInRange(a, b));
      } else if (tab === 3) {
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
      } else if (tab === 4) {
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
      } else if (tab === 5) {
        setStockRows(await getDailyFuelStockReport(from, to));
      } else if (tab === 6) {
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
      <Box
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          background: (t) =>
            `linear-gradient(120deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 52%, ${t.palette.primary.light} 115%)`,
          color: 'primary.contrastText',
          p: { xs: 2.5, sm: 3 },
          boxShadow: (t) => `0 12px 40px ${alpha(t.palette.primary.main, 0.3)}`,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <AssessmentOutlinedIcon sx={{ opacity: 0.95 }} />
          <Typography variant="overline" sx={{ opacity: 0.92, letterSpacing: '0.12em', fontWeight: 600 }}>
            Analytics
          </Typography>
        </Stack>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          Reports
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.92, mt: 0.75, maxWidth: 640 }}>
          Pick a tab, set From–To, then <strong>Run report</strong>. Daily sales uses closed shifts; other tabs use the same
          date window.
        </Typography>
      </Box>

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
            <Tab label="Employee" />
            <Tab label="Pump boys / girls" />
            <Tab label="Credit" />
            <Tab label="Expenses" />
            <Tab label="Fuel stock" />
            <Tab label="Cash & bank" />
          </Tabs>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, p: 2, alignItems: 'center' }}>
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
          {tab === 3 && (
            <TextField
              size="small"
              label="Customer name filter"
              value={custFilter}
              onChange={(e) => setCustFilter(e.target.value)}
              sx={{ minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
          )}
          {tab === 5 && (
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
          <Button variant="contained" color="secondary" onClick={run} disabled={loading} sx={{ borderRadius: 1.5, px: 2.5 }}>
            {loading ? 'Loading…' : 'Run report'}
          </Button>
        </Stack>
      </Paper>

      {tab === 0 && (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Daily sales by date (meter readings on shifts closed each day — same layout as cashier sheet)
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: '100%', overflowX: 'auto' }}>
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
          </TableContainer>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.6 }}>
            TOTAL AMOUNTS = AMOUNTS + AMOUNTS2 + AMOUNTS3
            {showOtherFuelCol ? ' + AMOUNTS4' : ''} for each date. Rows cover every calendar day from From–To (zero when no
            closed shift ended that day). Petrol/Diesel/XP grouping follows fuel type names from Manager → Fuel prices.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Total credit in reconciliations (shifts ending in range): ₹{dailyCredit.toFixed(2)} · Expenses: ₹
            {dailyExp.toFixed(2)} · Net (ledger in range, income − expense): ₹{dailyNet.toFixed(2)}
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

      {tab === 2 && (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
            Pump boys / girls attendants sheet
          </Typography>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Attendance roster by pump day (who was on duty — not a payment or sales split)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 900 }}>
            One row per name listed under <strong>Pump attendants</strong> on each <strong>closed</strong> shift. The pump
            day is the <strong>calendar date</strong> chosen when starting the shift. Columns show shift type, operator
            (cashier), and actual start/end times. For cash, UPI, and card breakdowns use shift reconciliation and other
            report tabs — this sheet is only the roster.
          </Typography>
          {attendanceRows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No rows yet. Run the report for a range that includes closed shifts with pump days in that period, and
              ensure attendant names are entered on <strong>Start shift</strong>.
            </Typography>
          ) : (
            <>
              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{
                  maxWidth: '100%',
                  overflowX: 'auto',
                  borderRadius: 1,
                }}
              >
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
              </TableContainer>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1.5, lineHeight: 1.6 }}>
                Same shift with several names produces one row per name. If no names were entered on Start shift, you still
                see one row with “—” so the shift appears on the roster.
              </Typography>
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

      {tab === 3 && (
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

      {tab === 4 && (
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

      {tab === 5 && (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            {stockReportKind === 'daily' && 'Daily dip report — dip readings and calculated stock'}
            {stockReportKind === 'tank' && 'Tank stock report — opening, sales, receipts, expected vs actual'}
            {stockReportKind === 'variation' && 'Variation report — rows where |variation| exceeds limit or dip missing'}
            {stockReportKind === 'monthly' && 'Monthly stock reconciliation — full period summary'}
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
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
          </TableContainer>
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
      {tab === 6 && (
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
