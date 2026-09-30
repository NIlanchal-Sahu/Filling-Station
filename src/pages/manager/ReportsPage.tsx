import { useEffect, useMemo, useRef, useState } from 'react';
import {
  alpha,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  MenuItem,
  Paper,
  Select,
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
import Grid from '@mui/material/Grid2';
import type { SvgIconComponent } from '@mui/icons-material';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import OpacityOutlinedIcon from '@mui/icons-material/OpacityOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import FolderOffOutlinedIcon from '@mui/icons-material/FolderOffOutlined';

import { DateRangePeriodControls } from '@/components/ui/DateRangePeriodControls';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReadOnlyBanner } from '@/components/ui/ReadOnlyBanner';
import { ResponsiveTableContainer } from '@/components/ui/ResponsiveTableContainer';
import { usePermissions } from '@/hooks/usePermissions';
import { format } from 'date-fns';
import {
  applyPeriodPreset,
  detectPreset,
  formatDateRangeLabel,
  type DatePreset,
} from '@/utils/dateRangePeriodPresets';
import { useSearchParams } from 'react-router-dom';
import { listClosedShiftsByPumpDayRange } from '@/services/shiftsService';
import {
  getDailySalesFuelPivot,
  getMeterRegisterRowsInRange,
  getOperatorPerformanceDailyInRange,
  getPumpAttendantAttendanceRowsInRange,
  type DailySalesPivotRow,
  type MeterRegisterRow,
  type OperatorPerformanceDailyRow,
  type PumpAttendantAttendanceRow,
} from '@/services/aggregatesService';
import { listCreditCustomers } from '@/services/creditCustomersService';
import { listAllCreditSales } from '@/services/creditSalesService';
import { listAllCreditPayments } from '@/services/creditPaymentsService';
import { listExpensesInRange, listLedgerInRange } from '@/services/ledgerService';
import { downloadCsv } from '@/utils/csvExport';
import { parsePumpDayParam } from '@/utils/dateEntryPolicy';
import {
  buildExpenseReportRows,
  expenseCategoryTotals,
  expenseGrandTotal,
  expenseRangeLabel,
  EXPENSE_REPORT_FILTERS,
  filterExpenseReportRows,
  type ExpenseReportFilter,
  type ExpenseReportRow,
} from '@/utils/expenseReport';
import { downloadExpenseReportCsv, downloadExpenseReportPdf } from '@/utils/expenseReportExport';
import { getDailyFuelStockReport } from '@/services/fuelStockReconciliationService';
import { listDipValueLedgerInRange } from '@/services/dipValueLedgerService';
import { listFuelTypes } from '@/services/fuelTypesService';
import { groupRegisterByFuel, type DipValueRegisterRow } from '@/utils/dipValueRegister';
import { fuelStockDisplayMeta } from '@/utils/fuelStockDisplay';
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
    maximumFractionDigits: 2,
  });
}

function fmtRupeesCell(n: number): string {
  const t = fmtInr(n);
  return `₹ ${t}`;
}

/** Operator performance money cells: always 20,000.00 style, slightly compact type */
const opAmountCellSx = {
  fontVariantNumeric: 'tabular-nums' as const,
  whiteSpace: 'nowrap' as const,
  fontSize: { xs: '0.75rem', sm: '0.8125rem' },
  px: { xs: 0.5, sm: 1 },
};

type TabId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

type StockReportKind = 'daily' | 'tank' | 'variation' | 'monthly' | 'dipValue';

function parseStockReportKind(raw: string | null): StockReportKind | null {
  if (raw === 'daily' || raw === 'tank' || raw === 'variation' || raw === 'monthly' || raw === 'dipValue') {
    return raw;
  }
  return null;
}

function fmtDipRegisterLiters(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

type ReportTabConfig = {
  id: TabId;
  label: string;
  icon: SvgIconComponent;
  description: string;
};

const REPORT_TABS: ReportTabConfig[] = [
  {
    id: 0,
    label: 'Daily Sales',
    icon: PointOfSaleOutlinedIcon,
    description: 'Fuel-wise daily sales, rates, and turnover',
  },
  {
    id: 1,
    label: 'Meter Register',
    icon: SpeedOutlinedIcon,
    description: 'Opening & closing nozzle meter readings and volume',
  },
  {
    id: 2,
    label: 'Employee',
    icon: BadgeOutlinedIcon,
    description: 'Operator volume, sales, and cash short/over',
  },
  {
    id: 3,
    label: 'Shift',
    icon: AccessTimeOutlinedIcon,
    description: 'Shift attendants, duty rosters, and machine assignments',
  },
  {
    id: 4,
    label: 'Credit',
    icon: CreditCardOutlinedIcon,
    description: 'Customer credit sales, repayments, and balances',
  },
  {
    id: 5,
    label: 'Expense',
    icon: ReceiptLongOutlinedIcon,
    description: 'Station operational outgo and category breakdown',
  },
  {
    id: 6,
    label: 'Inventory/Dip',
    icon: OpacityOutlinedIcon,
    description: 'Daily tank dips, book stock, receipts, and variations',
  },
  {
    id: 7,
    label: 'Collection',
    icon: AccountBalanceWalletOutlinedIcon,
    description: 'Cash and digital collection reconciliation and bank deposits',
  },
];

function ReportKpiCard(props: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: SvgIconComponent;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'info';
}) {
  const { label, value, subtitle, icon: Icon, color = 'primary' } = props;
  const isAccent = color === 'success' || color === 'warning';
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: 2,
        border: '1px solid',
        borderColor: isAccent ? (t) => alpha(t.palette[color].main, 0.4) : 'divider',
        height: '100%',
        bgcolor: isAccent
          ? (t) => alpha(t.palette[color].main, t.palette.mode === 'dark' ? 0.12 : 0.04)
          : 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          borderColor: (t) => alpha(t.palette[color === 'secondary' ? 'primary' : color].main, 0.5),
        },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'text.secondary',
            fontSize: { xs: '0.65rem', sm: '0.7rem' },
          }}
        >
          {label}
        </Typography>
        {Icon ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 1.5,
              bgcolor: (t) => alpha(t.palette[color === 'secondary' ? 'primary' : color].main, 0.1),
              color: `${color === 'secondary' ? 'primary' : color}.main`,
            }}
          >
            <Icon sx={{ fontSize: 16 }} />
          </Box>
        ) : null}
      </Stack>
      <Box sx={{ mt: 1.25 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            fontSize: { xs: '1.05rem', sm: '1.2rem', md: '1.25rem' },
            letterSpacing: '-0.02em',
            color:
              color === 'success'
                ? 'success.main'
                : color === 'warning'
                  ? 'warning.main'
                  : 'text.primary',
            wordBreak: 'break-word',
          }}
        >
          {value}
        </Typography>
        {subtitle ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.25, fontSize: '0.7rem' }}
          >
            {subtitle}
          </Typography>
        ) : null}
      </Box>
    </Paper>
  );
}

const tableHeadRowSx = {
  bgcolor: (t: { palette: { primary: { main: string }; mode: string } }) =>
    alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.16 : 0.06),
  '& th': {
    fontWeight: 700,
    fontSize: '0.72rem',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    color: 'text.secondary',
    borderBottom: '1px solid',
    borderColor: 'divider',
    whiteSpace: 'nowrap' as const,
  },
};

export function ReportsPage() {
  const { readOnlyOps } = usePermissions();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<TabId>(0);
  const [from, setFrom] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [to, setTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [preset, setPreset] = useState<DatePreset>('today');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const [dailyPivot, setDailyPivot] = useState<DailySalesPivotRow[]>([]);
  const [dailyCredit, setDailyCredit] = useState(0);
  const [dailyExp, setDailyExp] = useState(0);
  const [dailyNet, setDailyNet] = useState(0);
  const [dailyShiftCount, setDailyShiftCount] = useState(0);

  const [meterRows, setMeterRows] = useState<MeterRegisterRow[]>([]);
  const [op, setOp] = useState<OperatorPerformanceDailyRow[]>([]);
  const [creditRows, setCreditRows] = useState<
    { name: string; bal: number; sales: number; pay: number }[]
  >([]);
  const [expRows, setExpRows] = useState<ExpenseReportRow[]>([]);
  const [expRan, setExpRan] = useState(false);
  const [expFilter, setExpFilter] = useState<ExpenseReportFilter>('all');
  const [custFilter, setCustFilter] = useState('');
  const [attendanceRows, setAttendanceRows] = useState<PumpAttendantAttendanceRow[]>([]);
  const [stockRows, setStockRows] = useState<DailyFuelStockRow[]>([]);
  const [dipRegisterByFuel, setDipRegisterByFuel] = useState<Map<string, DipValueRegisterRow[]>>(new Map());
  const [dipRegisterFuelLabels, setDipRegisterFuelLabels] = useState<Map<string, string>>(new Map());
  const [stockReportKind, setStockReportKind] = useState<StockReportKind>('daily');
  const [collectionSummary, setCollectionSummary] = useState<CashBankCollectionSummary | null>(null);
  const [collectionDailyRows, setCollectionDailyRows] = useState<CashBankCollectionDailyRow[]>([]);
  const [collectionShiftDetails, setCollectionShiftDetails] = useState<CashBankCollectionShiftDetailRow[]>([]);

  const reportDeepLinkKey = useRef<string | null>(null);
  const hasMounted = useRef(false);

  useEffect(() => {
    const report = searchParams.get('report');
    if (report === 'collections') {
      setTab(7);
    } else if (report === 'expenses') {
      setTab(5);
    } else if (report === 'meters') {
      setTab(1);
    } else if (report === 'fuel-stock') {
      setTab(6);
      const kind = parseStockReportKind(searchParams.get('kind'));
      if (kind) setStockReportKind(kind);
    }
    const day = parsePumpDayParam(searchParams.get('day'));
    if (day) {
      setFrom(day);
      setTo(day);
      setPreset(detectPreset(day, day));
    }
  }, [searchParams]);

  const showOtherFuelCol = useMemo(
    () =>
      dailyPivot.some((r) => Math.abs(r.otherLiters) > 0.005 || Math.abs(r.otherAmount) > 0.005),
    [dailyPivot],
  );

  const expVisible = useMemo(
    () => filterExpenseReportRows(expRows, expFilter),
    [expRows, expFilter],
  );
  const expChips = useMemo(() => expenseCategoryTotals(expVisible), [expVisible]);
  const expTotal = useMemo(() => expenseGrandTotal(expVisible), [expVisible]);
  const expRange = useMemo(() => expenseRangeLabel(from, to), [from, to]);

  const dipRegisterFlatRows = useMemo(() => {
    const out: { row: DipValueRegisterRow; fuelLabel: string }[] = [];
    for (const [fuelTypeId, rows] of dipRegisterByFuel) {
      const fuelLabel = dipRegisterFuelLabels.get(fuelTypeId) ?? fuelTypeId;
      for (const row of rows) {
        out.push({ row, fuelLabel });
      }
    }
    return out.sort(
      (a, b) =>
        a.row.pumpDayIso.localeCompare(b.row.pumpDayIso) || a.fuelLabel.localeCompare(b.fuelLabel),
    );
  }, [dipRegisterByFuel, dipRegisterFuelLabels]);

  async function loadDipRegisterReport(fromIso: string, toIso: string) {
    const [fuels, ledger] = await Promise.all([listFuelTypes(), listDipValueLedgerInRange(fromIso, toIso)]);
    setDipRegisterFuelLabels(new Map(fuels.map((f) => [f.id, fuelStockDisplayMeta(f.name).shortCode])));
    setDipRegisterByFuel(groupRegisterByFuel(ledger));
    setStockRows([]);
  }

  async function run() {
    if (loading) return;
    setErr(null);
    setLoading(true);
    try {
      const a = new Date(from + 'T00:00:00');
      const b = new Date(to + 'T23:59:59.999');
      if (tab === 0) {
        setDailyPivot(await getDailySalesFuelPivot(a, b));
        const closed = await listClosedShiftsByPumpDayRange(a, b);
        setDailyShiftCount(closed.length);
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
        setOp(await getOperatorPerformanceDailyInRange(a, b));
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
        setExpRows(buildExpenseReportRows(ex));
        setExpRan(true);
      } else if (tab === 6) {
        if (stockReportKind === 'dipValue' || stockReportKind === 'daily') {
          await loadDipRegisterReport(from, to);
        } else {
          setStockRows(await getDailyFuelStockReport(from, to));
          setDipRegisterByFuel(new Map());
          setDipRegisterFuelLabels(new Map());
        }
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
      setHasRun(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Report failed');
    } finally {
      setLoading(false);
    }
  }

  // Deep-link auto-run handler
  useEffect(() => {
    const report = searchParams.get('report');
    const expectedTab =
      report === 'expenses' ? 5 : report === 'meters' ? 1 : report === 'fuel-stock' ? 6 : null;
    if (expectedTab == null || tab !== expectedTab) return;
    if (report === 'fuel-stock') {
      const kind = parseStockReportKind(searchParams.get('kind'));
      if (kind && stockReportKind !== kind) return;
    }
    const day = parsePumpDayParam(searchParams.get('day'));
    if (day && (from !== day || to !== day)) return;
    const key = searchParams.toString();
    if (reportDeepLinkKey.current === key) return;
    reportDeepLinkKey.current = key;

    let cancelled = false;
    void (async () => {
      setErr(null);
      setLoading(true);
      try {
        const a = new Date(`${from}T00:00:00`);
        const b = new Date(`${to}T23:59:59.999`);
        if (report === 'expenses') {
          const ex = await listExpensesInRange(a, b);
          if (cancelled) return;
          setExpRows(buildExpenseReportRows(ex));
          setExpRan(true);
        } else if (report === 'meters') {
          const rows = await getMeterRegisterRowsInRange(a, b);
          if (cancelled) return;
          setMeterRows(rows);
        } else if (
          report === 'fuel-stock' &&
          (stockReportKind === 'dipValue' || stockReportKind === 'daily')
        ) {
          await loadDipRegisterReport(from, to);
          if (cancelled) return;
        }
        if (!cancelled) setHasRun(true);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Report failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, tab, from, to, stockReportKind]);

  // Initial mount auto-run for default Today report
  useEffect(() => {
    if (hasMounted.current) return;
    hasMounted.current = true;
    const report = searchParams.get('report');
    if (!report) {
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePresetChange(p: DatePreset) {
    const next = applyPeriodPreset(p, { from, to });
    setPreset(next.preset);
    setFrom(next.from);
    setTo(next.to);
  }

  // Summary calculations
  const dailyTotalSales = useMemo(
    () => dailyPivot.reduce((s, r) => s + r.totalAmount, 0),
    [dailyPivot],
  );

  const meterTotalAmount = useMemo(
    () => meterRows.reduce((a, r) => a + r.amount, 0),
    [meterRows],
  );
  const meterTotalVolume = useMemo(
    () => meterRows.reduce((a, r) => a + r.sales, 0),
    [meterRows],
  );
  const meterTotalTas = useMemo(
    () => meterRows.reduce((a, r) => a + r.tas, 0),
    [meterRows],
  );

  const opStaffCount = useMemo(() => new Set(op.map((r) => r.pumpBoyGirl)).size, [op]);
  const opTotalVolume = useMemo(() => op.reduce((a, r) => a + r.totalLiters, 0), [op]);
  const opTotalAmount = useMemo(() => op.reduce((a, r) => a + r.amounts, 0), [op]);
  const opShortSum = useMemo(() => op.reduce((a, r) => a + r.short, 0), [op]);

  const creditTotalSales = useMemo(
    () => creditRows.reduce((a, r) => a + r.sales, 0),
    [creditRows],
  );
  const creditTotalPaid = useMemo(
    () => creditRows.reduce((a, r) => a + r.pay, 0),
    [creditRows],
  );
  const creditTotalBalance = useMemo(
    () => creditRows.reduce((a, r) => a + r.bal, 0),
    [creditRows],
  );

  // Check whether active report tab has records
  const hasData = useMemo(() => {
    if (!hasRun) return true;
    switch (tab) {
      case 0:
        return dailyPivot.length > 0;
      case 1:
        return meterRows.length > 0;
      case 2:
        return op.length > 0;
      case 3:
        return attendanceRows.length > 0;
      case 4:
        return creditRows.length > 0;
      case 5:
        return expVisible.length > 0;
      case 6:
        if (stockReportKind === 'daily') return dipRegisterFlatRows.length > 0;
        if (stockReportKind === 'dipValue') return dipRegisterByFuel.size > 0;
        return stockRows.length > 0;
      case 7:
        return collectionSummary != null || collectionDailyRows.length > 0;
      default:
        return true;
    }
  }, [
    hasRun,
    tab,
    dailyPivot,
    meterRows,
    op,
    attendanceRows,
    creditRows,
    expVisible,
    stockReportKind,
    dipRegisterFlatRows,
    dipRegisterByFuel,
    stockRows,
    collectionSummary,
    collectionDailyRows,
  ]);

  const activeTabConfig = REPORT_TABS[tab];

  return (
    <Stack spacing={{ xs: 2, sm: 2.5, md: 3 }} sx={{ pb: { xs: 12, sm: 8, md: 6 } }}>
      {readOnlyOps ? <ReadOnlyBanner /> : null}

      {/* HEADER */}
      <PageHeader
        title="Reports & Analytics"
        subtitle="View and generate business reports"
        action={
          hasRun && !loading && !err ? (
            <Chip
              size="small"
              icon={<CheckCircleOutlineOutlinedIcon sx={{ fontSize: '15px !important' }} />}
              label="✓ Report generated"
              color="success"
              variant="outlined"
              sx={{ fontWeight: 600, fontSize: '0.75rem', borderRadius: 1.5 }}
            />
          ) : null
        }
      />

      {err ? <Alert severity="error">{err}</Alert> : null}

      {/* REPORT SELECTOR */}
      <Paper
        variant="outlined"
        sx={{
          borderRadius: 2.5,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {/* Mobile Dropdown Selector (xs only - ensures 0 clipping and touch target) */}
        <Box sx={{ display: { xs: 'block', sm: 'none' }, p: 1.5 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'text.secondary',
              mb: 0.75,
              display: 'block',
              fontSize: '0.7rem',
            }}
          >
            Report Type
          </Typography>
          <FormControl fullWidth size="small">
            <Select
              value={tab}
              onChange={(e) => setTab(e.target.value as TabId)}
              sx={{
                borderRadius: 1.5,
                bgcolor: 'background.paper',
                fontWeight: 600,
                '& .MuiSelect-select': { py: 1.25 },
              }}
            >
              {REPORT_TABS.map((r) => {
                const Icon = r.icon;
                return (
                  <MenuItem key={r.id} value={r.id}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Icon fontSize="small" color={tab === r.id ? 'primary' : 'action'} />
                      <Typography variant="body2" sx={{ fontWeight: tab === r.id ? 700 : 500 }}>
                        {r.label}
                      </Typography>
                    </Stack>
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        </Box>

        {/* Desktop / Tablet Scrollable Tabs (sm and above) */}
        <Box
          sx={{
            display: { xs: 'none', sm: 'block' },
            bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.08 : 0.03),
            px: 1,
            pt: 0.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v as TabId)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              minHeight: 48,
              '& .MuiTab-root': {
                fontWeight: 600,
                textTransform: 'none',
                minHeight: 48,
                fontSize: '0.85rem',
                gap: 0.75,
                px: { sm: 1.5, md: 2 },
              },
            }}
          >
            {REPORT_TABS.map((r) => {
              const Icon = r.icon;
              return (
                <Tab
                  key={r.id}
                  value={r.id}
                  icon={<Icon sx={{ fontSize: 18 }} />}
                  iconPosition="start"
                  label={r.label}
                />
              );
            })}
          </Tabs>
        </Box>

        {/* DATE RANGE PRESETS & CONTROLS */}
        <Box sx={{ p: { xs: 1.75, sm: 2 } }}>
          <DateRangePeriodControls
            from={from}
            to={to}
            preset={preset}
            onPresetChange={handlePresetChange}
            onFromChange={(f) => {
              setFrom(f);
              setPreset('custom');
            }}
            onToChange={(t) => {
              setTo(t);
              setPreset('custom');
            }}
            loading={loading}
            onSubmit={() => void run()}
            submitLabel="Generate Report"
            submitLoadingLabel="Generating report…"
            submitIcon={PlayArrowOutlinedIcon}
          >
              {tab === 4 && (
                <TextField
                  size="small"
                  label="Customer name filter"
                  value={custFilter}
                  onChange={(e) => setCustFilter(e.target.value)}
                  placeholder="Search customer…"
                  sx={{ minWidth: { xs: '100%', sm: 220 }, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                />
              )}

              {/* Tab 5: Expense category filter */}
              {tab === 5 && (
                <TextField
                  select
                  size="small"
                  label="Category"
                  value={expFilter}
                  onChange={(e) => setExpFilter(e.target.value as ExpenseReportFilter)}
                  slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                  sx={{ minWidth: { xs: '100%', sm: 200 }, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                >
                  {EXPENSE_REPORT_FILTERS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </TextField>
              )}

              {/* Tab 6: Fuel Stock report type */}
              {tab === 6 && (
                <TextField
                  select
                  size="small"
                  label="Inventory Report Kind"
                  value={stockReportKind}
                  onChange={(e) => setStockReportKind(e.target.value as typeof stockReportKind)}
                  slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                  sx={{ minWidth: { xs: '100%', sm: 220 }, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
                >
                  <option value="daily">Daily dip register</option>
                  <option value="tank">Tank stock report</option>
                  <option value="variation">Variation report</option>
                  <option value="monthly">Monthly reconciliation</option>
                  <option value="dipValue">Dip value register</option>
                </TextField>
              )}
          </DateRangePeriodControls>
        </Box>
      </Paper>

      {/* REPORT CONTENT AREA */}
      {loading ? (
        <Paper
          variant="outlined"
          sx={{
            p: 6,
            borderRadius: 2.5,
            textAlign: 'center',
            bgcolor: 'background.paper',
          }}
        >
          <CircularProgress size={36} thickness={4} color="primary" />
          <Typography variant="body1" sx={{ mt: 2, fontWeight: 600 }}>
            Generating {activeTabConfig.label} report…
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Querying books and shift records for {formatDateRangeLabel(from, to)}
          </Typography>
        </Paper>
      ) : !hasData ? (
        <EmptyState
          icon={<FolderOffOutlinedIcon sx={{ fontSize: 44, color: 'text.secondary' }} />}
          title="No records found"
          description={`No records were found for ${formatDateRangeLabel(from, to)}. Try selecting another date range or quick preset.`}
          action={
            <Button
              variant="outlined"
              color="primary"
              startIcon={<CalendarTodayOutlinedIcon />}
              onClick={() => {
                setPreset('custom');
              }}
              sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 600 }}
            >
              Change Date Range
            </Button>
          }
        />
      ) : (
        <Stack spacing={{ xs: 2.5, sm: 3 }}>
          {/* TAB 0: DAILY SALES */}
          {tab === 0 && (
            <>
              {/* COMPACT SUMMARY BEFORE DETAILED REPORT */}
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'text.secondary',
                    mb: 1,
                    display: 'block',
                    fontSize: '0.72rem',
                  }}
                >
                  Daily Sales Summary
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
                    <ReportKpiCard
                      label="Total Sales"
                      value={fmtRupeesCell(dailyTotalSales)}
                      subtitle={`${dailyPivot.length} days recorded`}
                      icon={TrendingUpOutlinedIcon}
                      color="primary"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
                    <ReportKpiCard
                      label="Transactions"
                      value={
                        dailyShiftCount > 0
                          ? `${dailyShiftCount} shifts`
                          : `${dailyPivot.length} days`
                      }
                      subtitle="Closed shift records"
                      icon={PointOfSaleOutlinedIcon}
                      color="primary"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
                    <ReportKpiCard
                      label="Credit"
                      value={fmtRupeesCell(dailyCredit)}
                      subtitle="Shift credit issued"
                      icon={CreditCardOutlinedIcon}
                      color="warning"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
                    <ReportKpiCard
                      label="Expenses"
                      value={fmtRupeesCell(dailyExp)}
                      subtitle="Station outgo"
                      icon={ReceiptLongOutlinedIcon}
                      color="secondary"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 8, md: 2.4 }}>
                    <ReportKpiCard
                      label="Net"
                      value={fmtRupeesCell(dailyNet)}
                      subtitle="Income minus expenses"
                      icon={AccountBalanceWalletOutlinedIcon}
                      color={dailyNet >= 0 ? 'success' : 'secondary'}
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* DETAILED REPORT TABLE */}
              <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
                <Box
                  sx={{
                    p: { xs: 1.5, sm: 2 },
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: (t) => alpha(t.palette.grey[500], 0.03),
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    spacing={1.5}
                  >
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Daily Sales Breakdown
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateRangeLabel(from, to)} · Fuel meter sales &amp; rate history
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<FileDownloadOutlinedIcon />}
                      onClick={() => {
                        const baseCols = [
                          'DATE',
                          'PETROL_L',
                          'RATE_PETROL',
                          'AMOUNTS_PETROL_RS',
                          'DIESEL_L',
                          'RATE2_DIESEL',
                          'AMOUNTS2_DIESEL_RS',
                          'XP_L',
                          'RATE3_XP',
                          'AMOUNTS3_XP_RS',
                        ];
                        const extraCols = showOtherFuelCol
                          ? ['OTHER_L', 'RATE4_OTHER', 'AMOUNTS4_OTHER_RS']
                          : [];
                        const tail = ['TOTAL_AMOUNTS_RS'];
                        const hdr = [...baseCols, ...extraCols, ...tail];
                        const rows = dailyPivot.map((r) => {
                          const b = [
                            r.dateLabel,
                            r.petrolLiters,
                            r.petrolRate,
                            r.petrolAmount,
                            r.dieselLiters,
                            r.dieselRate,
                            r.dieselAmount,
                            r.xpLiters,
                            r.xpRate,
                            r.xpAmount,
                          ];
                          const o = showOtherFuelCol ? [r.otherLiters, r.otherRate, r.otherAmount] : [];
                          return [...b, ...o, r.totalAmount];
                        });
                        downloadCsv('daily_sales_pivot.csv', hdr, rows);
                      }}
                      sx={{ borderRadius: 1.5, fontWeight: 600, textTransform: 'none' }}
                    >
                      Export CSV
                    </Button>
                  </Stack>
                </Box>
                <ResponsiveTableContainer stickyFirstColumn>
                  <Table
                    size="small"
                    sx={{
                      minWidth: showOtherFuelCol ? 1240 : 1080,
                      '& th, & td': { borderBottom: '1px solid', borderColor: 'divider', py: 1.25 },
                    }}
                  >
                    <TableHead>
                      <TableRow sx={tableHeadRowSx}>
                        <TableCell>Date</TableCell>
                        <TableCell align="right">Petrol (L)</TableCell>
                        <TableCell align="right">Rate (₹)</TableCell>
                        <TableCell align="right">Petrol (₹)</TableCell>
                        <TableCell align="right">Diesel (L)</TableCell>
                        <TableCell align="right">Rate (₹)</TableCell>
                        <TableCell align="right">Diesel (₹)</TableCell>
                        <TableCell align="right">XP (L)</TableCell>
                        <TableCell align="right">Rate (₹)</TableCell>
                        <TableCell align="right">XP (₹)</TableCell>
                        {showOtherFuelCol ? (
                          <>
                            <TableCell align="right">Other (L)</TableCell>
                            <TableCell align="right">Rate (₹)</TableCell>
                            <TableCell align="right">Other (₹)</TableCell>
                          </>
                        ) : null}
                        <TableCell align="right">Total (₹)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {dailyPivot.map((r, idx) => (
                        <TableRow
                          key={r.dateIso}
                          sx={{
                            bgcolor:
                              idx % 2 === 1
                                ? (t) => alpha(t.palette.action.hover, 0.4)
                                : 'background.paper',
                            '&:hover': { bgcolor: (t) => alpha(t.palette.action.hover, 0.7) },
                          }}
                        >
                          <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                            {r.dateLabel}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.petrolLiters.toFixed(2)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.petrolRate.toFixed(2)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {fmtRupeesCell(r.petrolAmount)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.dieselLiters.toFixed(2)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.dieselRate.toFixed(2)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {fmtRupeesCell(r.dieselAmount)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.xpLiters.toFixed(2)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.xpRate.toFixed(2)}
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
                                {r.otherRate.toFixed(2)}
                              </TableCell>
                              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                {fmtRupeesCell(r.otherAmount)}
                              </TableCell>
                            </>
                          ) : null}
                          <TableCell
                            align="right"
                            sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}
                          >
                            {fmtRupeesCell(r.totalAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ResponsiveTableContainer>
              </Paper>
            </>
          )}

          {/* TAB 1: METER REGISTER */}
          {tab === 1 && (
            <>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'text.secondary',
                    mb: 1,
                    display: 'block',
                    fontSize: '0.72rem',
                  }}
                >
                  Meter Register Summary
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <ReportKpiCard
                      label="Total Amount"
                      value={fmtRupeesCell(meterTotalAmount)}
                      subtitle="Sales across meters"
                      icon={TrendingUpOutlinedIcon}
                      color="primary"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <ReportKpiCard
                      label="Volume Sold"
                      value={`${meterTotalVolume.toLocaleString('en-IN', { maximumFractionDigits: 1 })} L`}
                      subtitle="Net volume delivered"
                      icon={SpeedOutlinedIcon}
                      color="primary"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <ReportKpiCard
                      label="Nozzle Testing (TAS)"
                      value={`${meterTotalTas.toLocaleString('en-IN', { maximumFractionDigits: 1 })} L`}
                      subtitle="Test return volume"
                      icon={OpacityOutlinedIcon}
                      color="info"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <ReportKpiCard
                      label="Meter Readings"
                      value={meterRows.length}
                      subtitle="Total recorded intervals"
                      icon={PointOfSaleOutlinedIcon}
                      color="primary"
                    />
                  </Grid>
                </Grid>
              </Box>

              <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
                <Box
                  sx={{
                    p: { xs: 1.5, sm: 2 },
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: (t) => alpha(t.palette.grey[500], 0.03),
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    spacing={1.5}
                  >
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Meter Register
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateRangeLabel(from, to)} · Per-nozzle shift opening, closing and TAS
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<FileDownloadOutlinedIcon />}
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
                      sx={{ borderRadius: 1.5, fontWeight: 600, textTransform: 'none' }}
                    >
                      Export CSV
                    </Button>
                  </Stack>
                </Box>
                <ResponsiveTableContainer stickyFirstColumn>
                  <Table
                    size="small"
                    sx={{
                      minWidth: 1100,
                      '& th, & td': { borderBottom: '1px solid', borderColor: 'divider', py: 1.25 },
                    }}
                  >
                    <TableHead>
                      <TableRow sx={tableHeadRowSx}>
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
                        <TableCell align="right">Sales (L)</TableCell>
                        <TableCell align="right">Rate (₹)</TableCell>
                        <TableCell align="right">Amount (₹)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {meterRows.map((r, idx) => (
                        <TableRow
                          key={`${r.dateIso}-${r.machine}-${r.nozzle}-${r.timeInOut}-${idx}`}
                          sx={{
                            bgcolor:
                              idx % 2 === 1
                                ? (t) => alpha(t.palette.action.hover, 0.4)
                                : 'background.paper',
                            '&:hover': { bgcolor: (t) => alpha(t.palette.action.hover, 0.7) },
                          }}
                        >
                          <TableCell
                            sx={{
                              whiteSpace: 'nowrap',
                              fontWeight: 600,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
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
                          <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                            {r.fuelType}
                          </TableCell>
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
                          <TableCell
                            align="right"
                            sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}
                          >
                            {r.amount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ResponsiveTableContainer>
              </Paper>
            </>
          )}

          {/* TAB 2: EMPLOYEE PERFORMANCE */}
          {tab === 2 && (
            <>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'text.secondary',
                    mb: 1,
                    display: 'block',
                    fontSize: '0.72rem',
                  }}
                >
                  Employee Performance Summary
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <ReportKpiCard
                      label="Active Staff"
                      value={opStaffCount}
                      subtitle="Staff in register"
                      icon={BadgeOutlinedIcon}
                      color="primary"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <ReportKpiCard
                      label="Total Volume"
                      value={`${opTotalVolume.toLocaleString('en-IN', { maximumFractionDigits: 1 })} L`}
                      subtitle="Delivered by staff"
                      icon={SpeedOutlinedIcon}
                      color="primary"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <ReportKpiCard
                      label="Total Amount"
                      value={fmtRupeesCell(opTotalAmount)}
                      subtitle="Gross sales turnover"
                      icon={TrendingUpOutlinedIcon}
                      color="primary"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <ReportKpiCard
                      label="Total Short"
                      value={fmtRupeesCell(opShortSum)}
                      subtitle="Cash shortage (SHORT column)"
                      icon={AccountBalanceWalletOutlinedIcon}
                      color={opShortSum <= 0.005 ? 'success' : 'secondary'}
                    />
                  </Grid>
                </Grid>
              </Box>

              <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
                <Box
                  sx={{
                    p: { xs: 1.5, sm: 2 },
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: (t) => alpha(t.palette.grey[500], 0.03),
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    spacing={1.5}
                  >
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Operator Performance
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateRangeLabel(from, to)} · Daily register by pump boy/girl (reconciliation split)
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<FileDownloadOutlinedIcon />}
                      onClick={() =>
                        downloadCsv(
                          'operator_performance.csv',
                          [
                            'DATE',
                            'PUMP BOY/GIRL',
                            'AMOUNTS',
                            'PAYTM',
                            'ICICI',
                            'FLEET CARD',
                            'CREDIT',
                            'SHORT',
                            'CASH',
                          ],
                          op.map((r) => [
                            r.dateLabel,
                            r.pumpBoyGirl,
                            r.amounts,
                            r.paytm,
                            r.icici,
                            r.fleetCard,
                            r.credit,
                            r.short,
                            r.cash,
                          ]),
                        )
                      }
                      sx={{ borderRadius: 1.5, fontWeight: 600, textTransform: 'none' }}
                    >
                      Export CSV
                    </Button>
                  </Stack>
                </Box>
                <ResponsiveTableContainer>
                  <Table
                    size="small"
                    sx={{
                      minWidth: 920,
                      '& th, & td': { borderBottom: '1px solid', borderColor: 'divider', py: 1.25 },
                    }}
                  >
                    <TableHead>
                      <TableRow sx={tableHeadRowSx}>
                        <TableCell>Date</TableCell>
                        <TableCell>Pump boy/girl</TableCell>
                        <TableCell align="right" sx={opAmountCellSx}>
                          Amounts
                        </TableCell>
                        <TableCell align="right" sx={opAmountCellSx}>
                          Paytm
                        </TableCell>
                        <TableCell align="right" sx={opAmountCellSx}>
                          ICICI
                        </TableCell>
                        <TableCell align="right" sx={opAmountCellSx}>
                          Fleet card
                        </TableCell>
                        <TableCell align="right" sx={opAmountCellSx}>
                          Credit
                        </TableCell>
                        <TableCell align="right" sx={opAmountCellSx}>
                          Short
                        </TableCell>
                        <TableCell align="right" sx={opAmountCellSx}>
                          Cash
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {op.map((r, idx) => (
                        <TableRow
                          key={`${r.dateIso}-${r.pumpBoyGirl}-${idx}`}
                          sx={{
                            bgcolor:
                              idx % 2 === 1
                                ? (t) => alpha(t.palette.action.hover, 0.4)
                                : 'background.paper',
                            '&:hover': { bgcolor: (t) => alpha(t.palette.action.hover, 0.7) },
                          }}
                        >
                          <TableCell sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {r.dateLabel}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{r.pumpBoyGirl}</TableCell>
                          <TableCell align="right" sx={opAmountCellSx}>
                            {fmtInr(r.amounts)}
                          </TableCell>
                          <TableCell align="right" sx={opAmountCellSx}>
                            {fmtInr(r.paytm)}
                          </TableCell>
                          <TableCell align="right" sx={opAmountCellSx}>
                            {fmtInr(r.icici)}
                          </TableCell>
                          <TableCell align="right" sx={opAmountCellSx}>
                            {fmtInr(r.fleetCard)}
                          </TableCell>
                          <TableCell align="right" sx={opAmountCellSx}>
                            {fmtInr(r.credit)}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              ...opAmountCellSx,
                              fontWeight: r.short > 0.005 ? 700 : 400,
                              color: r.short > 0.005 ? 'warning.dark' : 'text.secondary',
                            }}
                          >
                            {fmtInr(r.short)}
                          </TableCell>
                          <TableCell align="right" sx={{ ...opAmountCellSx, fontWeight: 600 }}>
                            {fmtInr(r.cash)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ResponsiveTableContainer>
              </Paper>
            </>
          )}

          {/* TAB 3: SHIFT ATTENDANCE */}
          {tab === 3 && (
            <>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'text.secondary',
                    mb: 1,
                    display: 'block',
                    fontSize: '0.72rem',
                  }}
                >
                  Shift Attendance Summary
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <ReportKpiCard
                      label="Attendance Logs"
                      value={attendanceRows.length}
                      subtitle="Attendant-shift assignments"
                      icon={AccessTimeOutlinedIcon}
                      color="primary"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <ReportKpiCard
                      label="Active Staff"
                      value={
                        new Set(
                          attendanceRows
                            .map((r) => r.pumpBoyGirl)
                            .filter((n) => n && n !== '—'),
                        ).size
                      }
                      subtitle="Unique attendants on duty"
                      icon={BadgeOutlinedIcon}
                      color="primary"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <ReportKpiCard
                      label="Shifts Covered"
                      value={new Set(attendanceRows.map((r) => `${r.pumpDayIso}-${r.shiftLabel}`)).size}
                      subtitle="Operational shifts recorded"
                      icon={PointOfSaleOutlinedIcon}
                      color="primary"
                    />
                  </Grid>
                </Grid>
              </Box>

              <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
                <Box
                  sx={{
                    p: { xs: 1.5, sm: 2 },
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: (t) => alpha(t.palette.grey[500], 0.03),
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    spacing={1.5}
                  >
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Shift Attendance Register
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateRangeLabel(from, to)} · Attendant shift appearances and dispenser posts
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<FileDownloadOutlinedIcon />}
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
                      sx={{ borderRadius: 1.5, fontWeight: 600, textTransform: 'none' }}
                    >
                      Export CSV
                    </Button>
                  </Stack>
                </Box>
                <ResponsiveTableContainer stickyFirstColumn>
                  <Table
                    size="small"
                    sx={{
                      minWidth: 820,
                      '& th, & td': { borderBottom: '1px solid', borderColor: 'divider', py: 1.25 },
                    }}
                  >
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
                      {attendanceRows.map((r, i) => (
                        <TableRow
                          key={`${r.pumpDayIso}-${r.startAt}-${r.pumpBoyGirl}-${i}`}
                          sx={{
                            '&:nth-of-type(even)': {
                              bgcolor: (t) => alpha(t.palette.action.hover, 0.4),
                            },
                            '&:hover': { bgcolor: (t) => alpha(t.palette.action.hover, 0.7) },
                          }}
                        >
                          <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                            {r.dateLabel}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{r.pumpBoyGirl}</TableCell>
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
            </>
          )}

          {/* TAB 4: CREDIT */}
          {tab === 4 && (
            <>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'text.secondary',
                    mb: 1,
                    display: 'block',
                    fontSize: '0.72rem',
                  }}
                >
                  Credit Report Summary
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <ReportKpiCard
                      label="Customers"
                      value={creditRows.length}
                      subtitle="Active with movements"
                      icon={CreditCardOutlinedIcon}
                      color="primary"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <ReportKpiCard
                      label="Total Credit Sales"
                      value={fmtRupeesCell(creditTotalSales)}
                      subtitle="Cumulative sales in range"
                      icon={TrendingUpOutlinedIcon}
                      color="warning"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <ReportKpiCard
                      label="Total Paid"
                      value={fmtRupeesCell(creditTotalPaid)}
                      subtitle="Payments received"
                      icon={CheckCircleOutlineOutlinedIcon}
                      color="success"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <ReportKpiCard
                      label="Outstanding Balance"
                      value={fmtRupeesCell(creditTotalBalance)}
                      subtitle="Current net receivable"
                      icon={AccountBalanceWalletOutlinedIcon}
                      color={creditTotalBalance > 0 ? 'warning' : 'primary'}
                    />
                  </Grid>
                </Grid>
              </Box>

              <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
                <Box
                  sx={{
                    p: { xs: 1.5, sm: 2 },
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: (t) => alpha(t.palette.grey[500], 0.03),
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    spacing={1.5}
                  >
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Credit Report
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateRangeLabel(from, to)} · Customer credit sales, collections and current balances
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<FileDownloadOutlinedIcon />}
                      onClick={() =>
                        downloadCsv(
                          'credit_report.csv',
                          ['Name', 'TotalSales', 'TotalPaid', 'Balance'],
                          creditRows.map((r) => [r.name, r.sales, r.pay, r.bal]),
                        )
                      }
                      sx={{ borderRadius: 1.5, fontWeight: 600, textTransform: 'none' }}
                    >
                      Export CSV
                    </Button>
                  </Stack>
                </Box>
                <ResponsiveTableContainer>
                  <Table
                    size="small"
                    sx={{
                      minWidth: 600,
                      '& th, & td': { borderBottom: '1px solid', borderColor: 'divider', py: 1.25 },
                    }}
                  >
                    <TableHead>
                      <TableRow sx={tableHeadRowSx}>
                        <TableCell>Customer</TableCell>
                        <TableCell align="right">Total Sales (₹)</TableCell>
                        <TableCell align="right">Total Paid (₹)</TableCell>
                        <TableCell align="right">Current Balance (₹)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {creditRows.map((r, idx) => (
                        <TableRow
                          key={r.name + r.bal}
                          sx={{
                            bgcolor:
                              idx % 2 === 1
                                ? (t) => alpha(t.palette.action.hover, 0.4)
                                : 'background.paper',
                            '&:hover': { bgcolor: (t) => alpha(t.palette.action.hover, 0.7) },
                          }}
                        >
                          <TableCell sx={{ fontWeight: 600 }}>{r.name}</TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.sales.toFixed(2)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.pay.toFixed(2)}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              fontVariantNumeric: 'tabular-nums',
                              fontWeight: 700,
                              color: r.bal > 0 ? 'warning.main' : 'text.primary',
                            }}
                          >
                            {r.bal.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ResponsiveTableContainer>
              </Paper>
            </>
          )}

          {/* TAB 5: EXPENSES */}
          {tab === 5 && (
            <>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'text.secondary',
                    mb: 1,
                    display: 'block',
                    fontSize: '0.72rem',
                  }}
                >
                  Expenses Summary
                </Typography>
                <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <ReportKpiCard
                      label="Grand Total"
                      value={fmtRupeesCell(expTotal)}
                      subtitle="Total station outgo"
                      icon={ReceiptLongOutlinedIcon}
                      color="secondary"
                    />
                  </Grid>
                  <Grid size={{ xs: 6, sm: 4 }}>
                    <ReportKpiCard
                      label="Entries"
                      value={expVisible.length}
                      subtitle="Recorded vouchers"
                      icon={PointOfSaleOutlinedIcon}
                      color="primary"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <ReportKpiCard
                      label="Categories Active"
                      value={expChips.length}
                      subtitle="Expense categories"
                      icon={AccountBalanceWalletOutlinedIcon}
                      color="info"
                    />
                  </Grid>
                </Grid>

                {expChips.length > 0 ? (
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {expChips.map((c) => (
                      <Chip
                        key={c.key}
                        size="small"
                        variant="outlined"
                        label={`${c.key}: ${fmtRupeesCell(c.amount)}`}
                        sx={{ fontWeight: 600, borderRadius: 1.5 }}
                      />
                    ))}
                  </Stack>
                ) : null}
              </Box>

              <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
                <Box
                  sx={{
                    p: { xs: 1.5, sm: 2 },
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    bgcolor: (t) => alpha(t.palette.grey[500], 0.03),
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    spacing={1.5}
                  >
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Expenses Report
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateRangeLabel(from, to)} · Station expenditure vouchers and ledger debits
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<FileDownloadOutlinedIcon />}
                        disabled={!expRan || expVisible.length === 0}
                        onClick={() => downloadExpenseReportCsv(expRange, expVisible, expTotal)}
                        sx={{ borderRadius: 1.5, fontWeight: 600, textTransform: 'none' }}
                      >
                        Export CSV
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<PictureAsPdfOutlinedIcon />}
                        disabled={!expRan || expVisible.length === 0}
                        onClick={() => downloadExpenseReportPdf(expRange, expVisible, expTotal)}
                        sx={{ borderRadius: 1.5, fontWeight: 600, textTransform: 'none' }}
                      >
                        PDF
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
                <ResponsiveTableContainer>
                  <Table
                    size="small"
                    sx={{
                      minWidth: 720,
                      '& th, & td': { borderBottom: '1px solid', borderColor: 'divider', py: 1.25 },
                    }}
                  >
                    <TableHead>
                      <TableRow sx={tableHeadRowSx}>
                        <TableCell>Date</TableCell>
                        <TableCell>Paid To / Received From</TableCell>
                        <TableCell>Particular</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {expVisible.map((r, idx) => (
                        <TableRow
                          key={r.id}
                          sx={{
                            bgcolor:
                              idx % 2 === 1
                                ? (t) => alpha(t.palette.action.hover, 0.4)
                                : 'background.paper',
                            '&:hover': { bgcolor: (t) => alpha(t.palette.action.hover, 0.7) },
                          }}
                        >
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.dateLabel}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{r.name}</TableCell>
                          <TableCell>{r.particular}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Chip
                              size="small"
                              variant="outlined"
                              label={r.category}
                              sx={{ fontSize: '0.72rem', height: 22 }}
                            />
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: 600 }}
                          >
                            {fmtRupeesCell(r.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {expVisible.length > 0 ? (
                        <TableRow sx={{ bgcolor: (t) => alpha(t.palette.primary.main, 0.05) }}>
                          <TableCell colSpan={4} sx={{ fontWeight: 700 }}>
                            Grand Total
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                              whiteSpace: 'nowrap',
                              color: 'primary.main',
                              fontSize: '0.95rem',
                            }}
                          >
                            {fmtRupeesCell(expTotal)}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </ResponsiveTableContainer>
              </Paper>
            </>
          )}

          {/* TAB 6: INVENTORY / DIP */}
          {tab === 6 && stockReportKind === 'daily' && (
            <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
              <Box
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: (t) => alpha(t.palette.grey[500], 0.03),
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  spacing={1.5}
                >
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Daily Dip Register (Liters)
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateRangeLabel(from, to)} · Opening, receipts, sales and book balances
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<FileDownloadOutlinedIcon />}
                    disabled={dipRegisterFlatRows.length === 0}
                    onClick={() =>
                      downloadCsv(
                        `daily_dip_register_${from}_${to}.csv`,
                        [
                          'Date',
                          'Fuel',
                          'Opening_L',
                          'Receipt_L',
                          'Total_L',
                          'Sales_L',
                          'Closing_book_L',
                          'Variation_L',
                        ],
                        dipRegisterFlatRows.map(({ row, fuelLabel }) => [
                          row.pumpDayIso,
                          fuelLabel,
                          row.openingStockLiters,
                          row.receiptLiters,
                          row.totalStockLiters,
                          row.salesLiters,
                          row.closingBookLiters,
                          row.variationLiters ?? '',
                        ]),
                      )
                    }
                    sx={{ borderRadius: 1.5, fontWeight: 600, textTransform: 'none' }}
                  >
                    Export CSV
                  </Button>
                </Stack>
              </Box>
              <ResponsiveTableContainer stickyFirstColumn>
                <Table
                  size="small"
                  sx={{
                    minWidth: 820,
                    '& th, & td': { borderBottom: '1px solid', borderColor: 'divider', py: 1.25 },
                  }}
                >
                  <TableHead>
                    <TableRow sx={tableHeadRowSx}>
                      <TableCell>Date</TableCell>
                      <TableCell>Fuel</TableCell>
                      <TableCell align="right">Opening (L)</TableCell>
                      <TableCell align="right">Receipt (L)</TableCell>
                      <TableCell align="right">Total (L)</TableCell>
                      <TableCell align="right">Sales (L)</TableCell>
                      <TableCell align="right">Closing book (L)</TableCell>
                      <TableCell align="right">Variation (L)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dipRegisterFlatRows.map(({ row, fuelLabel }, idx) => (
                      <TableRow
                        key={`${row.pumpDayIso}-${fuelLabel}`}
                        sx={{
                          bgcolor:
                            idx % 2 === 1
                              ? (t) => alpha(t.palette.action.hover, 0.4)
                              : 'background.paper',
                          '&:hover': { bgcolor: (t) => alpha(t.palette.action.hover, 0.7) },
                        }}
                      >
                        <TableCell sx={{ fontWeight: 600 }}>{row.pumpDayIso}</TableCell>
                        <TableCell>
                          <Chip size="small" label={fuelLabel} sx={{ fontWeight: 700, height: 22 }} />
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {fmtDipRegisterLiters(row.openingStockLiters)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {fmtDipRegisterLiters(row.receiptLiters)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {fmtDipRegisterLiters(row.totalStockLiters)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {fmtDipRegisterLiters(row.salesLiters)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                          {fmtDipRegisterLiters(row.closingBookLiters)}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 700,
                            color:
                              row.variationLiters != null && row.variationLiters < 0
                                ? 'error.main'
                                : row.variationLiters != null && row.variationLiters > 0
                                  ? 'success.main'
                                  : 'text.secondary',
                          }}
                        >
                          {fmtDipRegisterLiters(row.variationLiters)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTableContainer>
            </Paper>
          )}

          {tab === 6 && stockReportKind === 'dipValue' && (
            <Box>
              <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden', mb: 2 }}>
                <Box
                  sx={{
                    p: { xs: 1.5, sm: 2 },
                    bgcolor: (t) => alpha(t.palette.grey[500], 0.03),
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    spacing={1.5}
                  >
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Dip Value Register (Liters)
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateRangeLabel(from, to)} · Fuel-wise tank dip values and reconciliation
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<FileDownloadOutlinedIcon />}
                      disabled={dipRegisterByFuel.size === 0}
                      onClick={() => {
                        const flat: (string | number)[][] = [];
                        for (const [fuelTypeId, rows] of dipRegisterByFuel) {
                          const label = dipRegisterFuelLabels.get(fuelTypeId) ?? fuelTypeId;
                          for (const r of rows) {
                            flat.push([
                              r.pumpDayIso,
                              label,
                              r.openingStockLiters,
                              r.receiptLiters,
                              r.totalStockLiters,
                              r.salesLiters,
                              r.closingBookLiters,
                              r.variationLiters ?? '',
                            ]);
                          }
                        }
                        flat.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])));
                        downloadCsv(
                          `dip_value_register_${from}_${to}.csv`,
                          [
                            'Date',
                            'Fuel',
                            'Opening_L',
                            'Receipt_L',
                            'Total_L',
                            'Sales_L',
                            'Closing_book_L',
                            'Variation_L',
                          ],
                          flat,
                        );
                      }}
                      sx={{ borderRadius: 1.5, fontWeight: 600, textTransform: 'none' }}
                    >
                      Export CSV
                    </Button>
                  </Stack>
                </Box>
              </Paper>
              <Stack spacing={2.5}>
                {[...dipRegisterByFuel.entries()]
                  .sort(([a], [b]) =>
                    (dipRegisterFuelLabels.get(a) ?? a).localeCompare(dipRegisterFuelLabels.get(b) ?? b),
                  )
                  .map(([fuelTypeId, rows]) => (
                    <Paper key={fuelTypeId} variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
                      <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: (t) => alpha(t.palette.primary.main, 0.04) }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                          {dipRegisterFuelLabels.get(fuelTypeId) ?? fuelTypeId}
                        </Typography>
                      </Box>
                      <ResponsiveTableContainer>
                        <Table
                          size="small"
                          sx={{
                            minWidth: 720,
                            '& th, & td': { borderBottom: '1px solid', borderColor: 'divider', py: 1.25 },
                          }}
                        >
                          <TableHead>
                            <TableRow sx={tableHeadRowSx}>
                              <TableCell>Date</TableCell>
                              <TableCell align="right">Opening (L)</TableCell>
                              <TableCell align="right">Receipt (L)</TableCell>
                              <TableCell align="right">Total (L)</TableCell>
                              <TableCell align="right">Sales (L)</TableCell>
                              <TableCell align="right">Closing book (L)</TableCell>
                              <TableCell align="right">Variation (L)</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {rows.map((r, idx) => (
                              <TableRow
                                key={r.pumpDayIso}
                                sx={{
                                  bgcolor:
                                    idx % 2 === 1
                                      ? (t) => alpha(t.palette.action.hover, 0.4)
                                      : 'background.paper',
                                  '&:hover': { bgcolor: (t) => alpha(t.palette.action.hover, 0.7) },
                                }}
                              >
                                <TableCell sx={{ fontWeight: 600 }}>{r.pumpDayIso}</TableCell>
                                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                  {fmtDipRegisterLiters(r.openingStockLiters)}
                                </TableCell>
                                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                  {fmtDipRegisterLiters(r.receiptLiters)}
                                </TableCell>
                                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                  {fmtDipRegisterLiters(r.totalStockLiters)}
                                </TableCell>
                                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                  {fmtDipRegisterLiters(r.salesLiters)}
                                </TableCell>
                                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                                  {fmtDipRegisterLiters(r.closingBookLiters)}
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{
                                    fontVariantNumeric: 'tabular-nums',
                                    fontWeight: 700,
                                    color:
                                      r.variationLiters != null && r.variationLiters < 0
                                        ? 'error.main'
                                        : r.variationLiters != null && r.variationLiters > 0
                                          ? 'success.main'
                                          : 'text.secondary',
                                  }}
                                >
                                  {fmtDipRegisterLiters(r.variationLiters)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ResponsiveTableContainer>
                    </Paper>
                  ))}
              </Stack>
            </Box>
          )}

          {tab === 6 && stockReportKind !== 'dipValue' && stockReportKind !== 'daily' && (
            <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
              <Box
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  bgcolor: (t) => alpha(t.palette.grey[500], 0.03),
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', sm: 'center' }}
                  spacing={1.5}
                >
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {stockReportKind === 'tank' && 'Tank Stock Report'}
                      {stockReportKind === 'variation' && 'Tank Variation Report'}
                      {stockReportKind === 'monthly' && 'Monthly Stock Report'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateRangeLabel(from, to)} · Physical dip cm, expected vs actual stock liters
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<FileDownloadOutlinedIcon />}
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
                    sx={{ borderRadius: 1.5, fontWeight: 600, textTransform: 'none' }}
                  >
                    Export CSV
                  </Button>
                </Stack>
              </Box>
              <ResponsiveTableContainer stickyFirstColumn>
                <Table
                  size="small"
                  sx={{
                    minWidth: 900,
                    '& th, & td': { borderBottom: '1px solid', borderColor: 'divider', py: 1.25 },
                  }}
                >
                  <TableHead>
                    <TableRow sx={tableHeadRowSx}>
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
                      .map((r, idx) => (
                        <TableRow
                          key={`${r.pumpDayIso}-${r.fuelTypeId}`}
                          sx={{
                            bgcolor:
                              idx % 2 === 1
                                ? (t) => alpha(t.palette.action.hover, 0.4)
                                : 'background.paper',
                            '&:hover': { bgcolor: (t) => alpha(t.palette.action.hover, 0.7) },
                          }}
                        >
                          <TableCell sx={{ fontWeight: 600 }}>{r.pumpDayIso}</TableCell>
                          <TableCell>
                            <Chip size="small" label={r.shortCode} sx={{ fontWeight: 700, height: 22 }} />
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.closingDipCm ?? r.currentDipCm ?? '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.openingStockLiters.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.salesLiters.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.receiptLiters.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.expectedStockLiters.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
                          >
                            {r.actualStockLiters != null ? r.actualStockLiters.toLocaleString('en-IN') : '—'}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              fontVariantNumeric: 'tabular-nums',
                              fontWeight: 700,
                              color:
                                r.variationLiters != null && r.variationLiters < 0
                                  ? 'error.main'
                                  : r.variationLiters != null && r.variationLiters > 0
                                    ? 'success.main'
                                    : 'text.secondary',
                            }}
                          >
                            {r.variationLiters != null ? r.variationLiters.toLocaleString('en-IN') : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </ResponsiveTableContainer>
            </Paper>
          )}

          {/* TAB 7: COLLECTION (CASH & BANK) */}
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
      )}
    </Stack>
  );
}
