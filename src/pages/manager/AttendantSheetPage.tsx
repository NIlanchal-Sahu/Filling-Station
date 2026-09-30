import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  alpha,
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { format } from 'date-fns';
import { FilterToolbar } from '@/components/ui/FilterToolbar';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReadOnlyBanner } from '@/components/ui/ReadOnlyBanner';
import { ResponsiveTableContainer } from '@/components/ui/ResponsiveTableContainer';
import { usePermissions } from '@/hooks/usePermissions';
import {
  getAttendantPayrollSummaryInRange,
  getPumpAttendantAttendanceRowsInRange,
  type AttendantPayrollSummaryRow,
  type PumpAttendantAttendanceRow,
} from '@/services/aggregatesService';
import { downloadCsv } from '@/utils/csvExport';
import { parsePumpDayParam, withPumpDayQuery } from '@/utils/dateEntryPolicy';
import { useSearchParams } from 'react-router-dom';

type ViewTab = 'register' | 'pay';

const REGISTER_CSV_HEADERS = [
  'PumpDay_ISO',
  'Date_DDMMYYYY',
  'Pump_boy_girl',
  'Shift',
  'Machine',
  'Operator',
  'Start_local',
  'End_local',
  'Remarks',
] as const;

const PAY_CSV_HEADERS = [
  'Staff',
  'Base_salary_INR',
  'Shifts_worked',
  'Absent_days',
  'Allowed_paid_leaves',
  'Total_paid_days',
  'Daily_rate_INR',
  'Gross_due_INR',
  'Salary_paid_INR',
  'Advance_paid_INR',
  'Short_INR',
  'Net_balance_INR',
] as const;

function rowsToRegisterCsv(rows: PumpAttendantAttendanceRow[]): (string | number)[][] {
  return rows.map((r) => [
    r.pumpDayIso,
    r.dateLabel,
    r.pumpBoyGirl,
    r.shiftLabel,
    r.machineLabel,
    r.operatorName,
    r.startAt,
    r.endAt,
    r.remarks,
  ]);
}

function rowsToPayCsv(rows: AttendantPayrollSummaryRow[]): (string | number)[][] {
  return rows.map((r) => [
    r.staffName,
    r.baseSalaryInr ?? '',
    r.shiftsWorked,
    r.absentDays,
    r.allowedPaidLeaves,
    r.totalPaidDays,
    r.dailyRateInr ?? '',
    r.grossDueInr ?? '',
    r.salaryPaidInr,
    r.advancePaidInr,
    r.shortAmountInr,
    r.netBalanceInr ?? '',
  ]);
}

function fmtInr(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtInrTotal(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const payMoneyCellSx = {
  fontVariantNumeric: 'tabular-nums' as const,
  whiteSpace: 'nowrap' as const,
  fontSize: { xs: '0.75rem', sm: '0.8125rem' },
  px: { xs: 0.5, sm: 1 },
};

function sumPayField(rows: AttendantPayrollSummaryRow[], pick: (r: AttendantPayrollSummaryRow) => number): number {
  return rows.reduce((s, r) => s + pick(r), 0);
}

const tableHeadRowSx = {
  bgcolor: (t: { palette: { primary: { main: string }; mode: string } }) =>
    alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.16 : 0.06),
  '& th': {
    fontWeight: 700,
    fontSize: '0.7rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: 'text.secondary',
  },
};

export function AttendantSheetPage() {
  const { readOnlyOps } = usePermissions();
  const [searchParams] = useSearchParams();
  const [viewTab, setViewTab] = useState<ViewTab>('register');
  const [from, setFrom] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [to, setTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [rows, setRows] = useState<PumpAttendantAttendanceRow[]>([]);
  const [payRows, setPayRows] = useState<AttendantPayrollSummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const day = parsePumpDayParam(searchParams.get('day'));
    if (day) {
      setFrom(day);
      setTo(day);
    }
  }, [searchParams]);

  const run = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const a = new Date(`${from}T00:00:00`);
      const b = new Date(`${to}T23:59:59.999`);
      const [register, pay] = await Promise.all([
        getPumpAttendantAttendanceRowsInRange(a, b),
        getAttendantPayrollSummaryInRange(a, b),
      ]);
      setRows(register);
      setPayRows(pay);
      setRan(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load attendant sheet');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void run();
  }, [run]);

  function handlePrint() {
    window.print();
  }

  function handleExport() {
    if (viewTab === 'pay') {
      const basename =
        from === to ? `attendant_pay_summary_${from}.csv` : `attendant_pay_summary_${from}_${to}.csv`;
      downloadCsv(basename, [...PAY_CSV_HEADERS], rowsToPayCsv(payRows));
      return;
    }
    const basename =
      from === to ? `attendant_sheet_${from}.csv` : `attendant_sheet_${from}_${to}.csv`;
    downloadCsv(basename, [...REGISTER_CSV_HEADERS], rowsToRegisterCsv(rows));
  }

  const payTotals = useMemo(() => {
    const gross = sumPayField(payRows, (r) => r.grossDueInr ?? 0);
    const salary = sumPayField(payRows, (r) => r.salaryPaidInr);
    const advance = sumPayField(payRows, (r) => r.advancePaidInr);
    const short = sumPayField(payRows, (r) => r.shortAmountInr);
    const net = sumPayField(payRows, (r) => r.netBalanceInr ?? 0);
    return { gross, salary, advance, short, net };
  }, [payRows]);

  const activeEmpty =
    viewTab === 'register'
      ? rows.length === 0
      : payRows.every(
          (r) =>
            r.shiftsWorked === 0 &&
            r.salaryPaidInr === 0 &&
            r.advancePaidInr === 0 &&
            r.shortAmountInr === 0 &&
            (r.grossDueInr ?? 0) === 0,
        );

  return (
    <Stack
      spacing={3}
      className="attendant-sheet-page"
      sx={{
        pb: 4,
        '@media print': {
          '& .no-print': { display: 'none !important' },
        },
      }}
    >
      {readOnlyOps ? <ReadOnlyBanner /> : null}

      <Box className="no-print">
        <PageHeader
          title="Attendant sheet"
          subtitle="Shift register and staff pay summary (30-day month, +2 paid leaves, net balance after short). Set base salary on Team or Staff pay."
        />
      </Box>

      {err ? (
        <Alert severity="error" className="no-print">
          {err}
        </Alert>
      ) : null}

      <Tabs
        className="no-print"
        value={viewTab}
        onChange={(_, v: ViewTab) => setViewTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Detail register" value="register" sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab label="Pay summary" value="pay" sx={{ textTransform: 'none', fontWeight: 600 }} />
      </Tabs>

      <FilterToolbar className="no-print">
        <TextField
          type="date"
          size="small"
          label="From"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
        />
        <TextField
          type="date"
          size="small"
          label="To"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
        />
        <Box sx={{ flex: 1 }} />
        <Chip
          size="small"
          label={
            loading
              ? 'Loading…'
              : ran
                ? viewTab === 'register'
                  ? `${rows.length} rows`
                  : `${payRows.length} staff`
                : 'Ready'
          }
          variant="outlined"
          sx={{ fontWeight: 600, display: { xs: 'none', sm: 'flex' } }}
        />
        <Button
          variant="contained"
          color="secondary"
          onClick={() => void run()}
          disabled={loading}
          sx={{ borderRadius: 1.5, px: 2.5, minHeight: 48 }}
        >
          {loading ? 'Loading…' : 'Run'}
        </Button>
      </FilterToolbar>

      <Stack direction="row" spacing={1} className="no-print" flexWrap="wrap">
        <Button
          size="small"
          variant="outlined"
          startIcon={<PrintOutlinedIcon />}
          disabled={!ran || activeEmpty}
          onClick={handlePrint}
          sx={{ borderRadius: 1.5 }}
        >
          Print
        </Button>
        <Button
          size="small"
          variant="outlined"
          disabled={!ran || activeEmpty}
          onClick={handleExport}
          sx={{ borderRadius: 1.5 }}
        >
          Export CSV
        </Button>
      </Stack>

      {!ran && !loading ? null : viewTab === 'register' ? (
        rows.length === 0 && !loading ? (
          <Typography variant="body2" color="text.secondary">
            No closed shifts with attendants in this range. Capture staff on{' '}
            <strong>Start shift</strong> and ensure shifts are closed; keep the Team roster up to date.
          </Typography>
        ) : (
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Attendant register
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {from === to ? from : `${from} — ${to}`}
              </Typography>
            </Box>
            <ResponsiveTableContainer stickyFirstColumn>
              <Table size="small" sx={{ minWidth: 820 }}>
                <TableHead>
                  <TableRow sx={tableHeadRowSx}>
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
                  {rows.map((r, i) => (
                    <TableRow
                      key={`${r.pumpDayIso}-${r.startAt}-${r.pumpBoyGirl}-${i}`}
                      sx={{
                        '&:nth-of-type(even)': { bgcolor: (t) => alpha(t.palette.action.hover, 0.35) },
                      }}
                    >
                      <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {r.dateLabel}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{r.pumpBoyGirl}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.shiftLabel}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{r.machineLabel}</TableCell>
                      <TableCell>{r.operatorName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {r.startAt}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {r.endAt}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 280, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {r.remarks || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>
          </Paper>
        )
      ) : payRows.length === 0 && !loading ? (
        <Typography variant="body2" color="text.secondary">
          No payroll data for this range. Add shift attendants, set pay rates on{' '}
          <strong>Admin → Staff pay</strong> (or Team), and record SALARY / ADVANCE SALARY in the ledger using the
          same staff name.
        </Typography>
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              Pay summary
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {from === to ? from : `${from} — ${to}`} · Gross = (shifts + 2 paid leaves) × (base ÷ 30) · Net = gross −
              paid − short
            </Typography>
          </Box>
          <ResponsiveTableContainer stickyFirstColumn stickyLastColumn>
            <Table size="small" sx={{ minWidth: 1100 }}>
              <TableHead>
                <TableRow sx={tableHeadRowSx}>
                  <TableCell>Staff name</TableCell>
                  <TableCell align="right">Base salary (₹)</TableCell>
                  <TableCell align="right">Shifts worked</TableCell>
                  <TableCell align="right">Absent days</TableCell>
                  <TableCell align="right">Paid leaves (+2)</TableCell>
                  <TableCell align="right">Total paid days</TableCell>
                  <TableCell align="right">Daily rate (₹)</TableCell>
                  <TableCell align="right">Gross due (₹)</TableCell>
                  <TableCell align="right">Salary paid (₹)</TableCell>
                  <TableCell align="right">Advance paid (₹)</TableCell>
                  <TableCell align="right">Short (₹)</TableCell>
                  <TableCell align="right">Net balance (₹)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payRows.map((r) => (
                  <TableRow
                    key={r.staffName}
                    sx={{
                      '&:nth-of-type(even)': { bgcolor: (t) => alpha(t.palette.action.hover, 0.35) },
                    }}
                  >
                    <TableCell sx={{ fontWeight: 600 }}>{r.staffName}</TableCell>
                    <TableCell align="right" sx={payMoneyCellSx}>
                      {fmtInr(r.baseSalaryInr)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {r.shiftsWorked}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {r.absentDays}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      +{r.allowedPaidLeaves}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {r.totalPaidDays}
                    </TableCell>
                    <TableCell align="right" sx={payMoneyCellSx}>
                      {fmtInr(r.dailyRateInr)}
                    </TableCell>
                    <TableCell align="right" sx={{ ...payMoneyCellSx, fontWeight: 600 }}>
                      {fmtInr(r.grossDueInr)}
                    </TableCell>
                    <TableCell align="right" sx={payMoneyCellSx}>
                      {fmtInr(r.salaryPaidInr)}
                    </TableCell>
                    <TableCell align="right" sx={payMoneyCellSx}>
                      {fmtInr(r.advancePaidInr)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        ...payMoneyCellSx,
                        color: r.shortAmountInr > 0.005 ? 'error.main' : undefined,
                      }}
                    >
                      {fmtInr(r.shortAmountInr)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        ...payMoneyCellSx,
                        fontWeight: 700,
                        color:
                          r.netBalanceInr != null && r.netBalanceInr < -0.005
                            ? 'error.main'
                            : r.netBalanceInr != null && r.netBalanceInr > 0.005
                              ? 'warning.main'
                              : undefined,
                      }}
                    >
                      {fmtInr(r.netBalanceInr)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow
                  sx={{
                    bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.12 : 0.05),
                    '& td': { borderTop: 2, borderColor: 'divider', fontWeight: 700 },
                  }}
                >
                  <TableCell colSpan={7} sx={{ fontWeight: 800 }}>
                    Totals
                  </TableCell>
                  <TableCell align="right" sx={payMoneyCellSx}>
                    {fmtInrTotal(payTotals.gross)}
                  </TableCell>
                  <TableCell align="right" sx={payMoneyCellSx}>
                    {fmtInrTotal(payTotals.salary)}
                  </TableCell>
                  <TableCell align="right" sx={payMoneyCellSx}>
                    {fmtInrTotal(payTotals.advance)}
                  </TableCell>
                  <TableCell align="right" sx={{ ...payMoneyCellSx, color: 'error.main' }}>
                    {fmtInrTotal(payTotals.short)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      ...payMoneyCellSx,
                      color:
                        payTotals.net < -0.005
                          ? 'error.main'
                          : payTotals.net > 0.005
                            ? 'warning.main'
                            : undefined,
                    }}
                  >
                    {fmtInrTotal(payTotals.net)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </Paper>
      )}
    </Stack>
  );
}

/** Deep link helper for dashboards */
export function attendantSheetPath(pumpDayIso: string): string {
  return withPumpDayQuery('/manager/attendant-sheet', pumpDayIso);
}
