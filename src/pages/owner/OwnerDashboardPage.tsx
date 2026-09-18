import { useEffect, useMemo, useState } from 'react';
import { Alert, Chip, Paper, Stack, TextField } from '@mui/material';
import Grid from '@mui/material/Grid2';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import OpacityOutlinedIcon from '@mui/icons-material/OpacityOutlined';
import { format, isSameDay } from 'date-fns';
import { Link as RouterLink } from 'react-router-dom';
import { DashboardSection } from '@/components/ui/DashboardSection';
import { KpiStat } from '@/components/ui/KpiStat';
import { KpiStatSkeleton } from '@/components/ui/KpiStatSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { FloatingActionPanel } from '@/components/ui/FloatingActionPanel';
import { CashBankCollectionSummary } from '@/pages/manager/CashBankCollectionSummary';
import { SalesByFuelChart } from '@/pages/manager/SalesByFuelChart';
import { TankStockDipSummary } from '@/pages/manager/TankStockDipSummary';
import { TodaySalesByShiftSection } from '@/pages/manager/TodaySalesByShiftSection';
import { TodayShiftStatusSection } from '@/pages/manager/TodayShiftStatusSection';
import {
  CREDIT_OVERDUE_DAYS,
  getOverdueCreditSummary,
  getPumpDaySalesOverview,
} from '@/services/aggregatesService';
import { getTankStockDaySummary } from '@/services/fuelStockReconciliationService';
import { listLedgerInRange } from '@/services/ledgerService';
import { bucketDayOutflows } from '@/utils/dailyCashSheet';

function parseLocalYmd(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function fmtInr(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

const ownerQuickActions = [
  { to: '/manager/daily-sheet', label: 'Daily sheet', icon: <ReceiptLongOutlinedIcon fontSize="small" /> },
  { to: '/manager/credit', label: 'Credit', icon: <CreditCardOutlinedIcon fontSize="small" /> },
  { to: '/manager/reconciliations', label: 'Reconciliations', icon: <FactCheckOutlinedIcon fontSize="small" /> },
  { to: '/manager/reports', label: 'Reports', icon: <AssessmentOutlinedIcon fontSize="small" /> },
  { to: '/manager/fuel-stock/daily', label: 'Fuel & stock', icon: <Inventory2OutlinedIcon fontSize="small" /> },
] as const;

type AttentionItem = {
  severity: 'warning' | 'error';
  message: string;
  to: string;
};

export function OwnerDashboardPage() {
  const [reportIso, setReportIso] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const maxSelectableIso = format(new Date(), 'yyyy-MM-dd');
  const reportDay = useMemo(() => parseLocalYmd(reportIso), [reportIso]);
  const reportLabel = useMemo(
    () => (Number.isFinite(reportDay.getTime()) ? format(reportDay, 'dd MMM yyyy') : reportIso),
    [reportDay, reportIso],
  );
  const isSelectedToday = Number.isFinite(reportDay.getTime()) && isSameDay(reportDay, new Date());

  const [kpisLoading, setKpisLoading] = useState(true);
  const [meterSales, setMeterSales] = useState(0);
  const [reconciledSales, setReconciledSales] = useState(0);
  const [cashCollected, setCashCollected] = useState(0);
  const [shortage, setShortage] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [variationLiters, setVariationLiters] = useState(0);
  const [variationCount, setVariationCount] = useState(0);
  const [overdueCredit, setOverdueCredit] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    let ok = true;
    setKpisLoading(true);
    void (async () => {
      try {
        const dayStart = new Date(`${reportIso}T00:00:00`);
        const dayEnd = new Date(`${reportIso}T23:59:59.999`);
        const [sales, credit, ledger, stock] = await Promise.all([
          getPumpDaySalesOverview(reportIso),
          getOverdueCreditSummary(),
          listLedgerInRange(dayStart, dayEnd),
          getTankStockDaySummary(reportIso),
        ]);
        if (!ok) {
          return;
        }
        setMeterSales(sales.meterSalesAmount);
        setReconciledSales(sales.reconciledSalesAmount);
        setCashCollected(sales.cashCollected);
        setShortage(sales.shortageAmount);
        setExpenses(bucketDayOutflows(ledger).expenses);
        const varied = stock.rows.filter((r) => r.variationAlert && r.variationLiters != null);
        setVariationCount(varied.length);
        setVariationLiters(varied.reduce((sum, r) => sum + Math.abs(r.variationLiters ?? 0), 0));
        setOverdueCredit(credit.overdueAmount);
        setOverdueCount(credit.overdueCount);
      } catch {
        if (ok) {
          setMeterSales(0);
          setReconciledSales(0);
          setCashCollected(0);
          setShortage(0);
          setExpenses(0);
          setVariationLiters(0);
          setVariationCount(0);
          setOverdueCredit(0);
          setOverdueCount(0);
        }
      } finally {
        if (ok) {
          setKpisLoading(false);
        }
      }
    })();
    return () => {
      ok = false;
    };
  }, [reportIso]);

  const attention = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    if (shortage > 0.005) {
      items.push({
        severity: 'error',
        message: `Cash shortage ${fmtInr(shortage)} on this pump day.`,
        to: '/manager/daily-sheet',
      });
    }
    if (variationCount > 0) {
      items.push({
        severity: 'warning',
        message: `${variationCount} tank${variationCount === 1 ? '' : 's'} over the dip variation limit (${variationLiters.toLocaleString('en-IN')} L).`,
        to: '/manager/fuel-stock/daily',
      });
    }
    if (overdueCount > 0) {
      items.push({
        severity: 'warning',
        message: `${overdueCount} credit part${overdueCount === 1 ? 'y' : 'ies'} unpaid for ${CREDIT_OVERDUE_DAYS}+ days (${fmtInr(overdueCredit)}).`,
        to: '/manager/credit',
      });
    }
    return items;
  }, [shortage, variationCount, variationLiters, overdueCount, overdueCredit]);

  return (
    <>
      <Stack spacing={3.5} sx={{ pb: 4, pr: { xs: 6, sm: 7 } }}>
        <PageHeader
          title="Owner dashboard"
          subtitle={`${reportLabel}${isSelectedToday ? ' · Today' : ''}`}
          action={
            isSelectedToday ? (
              <Chip label="Live" size="small" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
            ) : null
          }
        />

        <Paper
          elevation={0}
          sx={{
            p: 1.75,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <CalendarMonthOutlinedIcon sx={{ fontSize: 22, color: 'text.secondary', display: { xs: 'none', sm: 'block' } }} />
              <TextField
                type="date"
                label="Pump day"
                value={reportIso}
                onChange={(e) => setReportIso(e.target.value)}
                size="small"
                slotProps={{
                  htmlInput: { max: maxSelectableIso },
                  inputLabel: { shrink: true },
                }}
                sx={{ minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
              />
            </Stack>
          </Stack>
        </Paper>

        {kpisLoading ? null : attention.length === 0 ? (
          <Alert severity="success" sx={{ borderRadius: 2 }}>
            Day looks clean — no shortage, tank variation, or overdue credit.
          </Alert>
        ) : (
          <Stack spacing={1}>
            {attention.map((item) => (
              <Alert
                key={item.message}
                severity={item.severity}
                sx={{ borderRadius: 2 }}
                action={
                  <Chip
                    component={RouterLink}
                    to={item.to}
                    clickable
                    size="small"
                    label="Open"
                    color={item.severity === 'error' ? 'error' : 'warning'}
                    sx={{ fontWeight: 700 }}
                  />
                }
              >
                {item.message}
              </Alert>
            ))}
          </Stack>
        )}

        <Grid container spacing={2}>
          {kpisLoading ? (
            Array.from({ length: 6 }, (_, i) => (
              <Grid key={i} size={{ xs: 6, sm: 4, md: 4 }}>
                <KpiStatSkeleton />
              </Grid>
            ))
          ) : (
            <>
              <Grid size={{ xs: 6, sm: 4, md: 4 }}>
                <KpiStat
                  label="Meter sales"
                  value={fmtInr(meterSales)}
                  subtitle={`${fmtInr(reconciledSales)} in the books`}
                  icon={PaymentsOutlinedIcon}
                  animateOnMount
                  staggerIndex={1}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 4 }}>
                <KpiStat
                  label="Cash collected"
                  value={fmtInr(cashCollected)}
                  icon={PaymentsOutlinedIcon}
                  color="success"
                  animateOnMount
                  staggerIndex={2}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 4 }}>
                <KpiStat
                  label="Shortage"
                  value={fmtInr(shortage)}
                  icon={WarningAmberOutlinedIcon}
                  color={shortage > 0.005 ? 'error' : 'success'}
                  animateOnMount
                  staggerIndex={3}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 4 }}>
                <KpiStat
                  label="Expenses"
                  value={fmtInr(expenses)}
                  icon={ReceiptLongOutlinedIcon}
                  color={expenses > 0.005 ? 'warning' : 'success'}
                  to="/manager/daily-sheet"
                  animateOnMount
                  staggerIndex={4}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 4 }}>
                <KpiStat
                  label="Tank variation"
                  value={`${variationLiters.toLocaleString('en-IN')} L`}
                  subtitle={variationCount === 0 ? 'Within limit' : `${variationCount} tank${variationCount === 1 ? '' : 's'}`}
                  icon={OpacityOutlinedIcon}
                  color={variationCount > 0 ? 'warning' : 'success'}
                  animateOnMount
                  staggerIndex={5}
                />
              </Grid>
              <Grid size={{ xs: 6, sm: 4, md: 4 }}>
                <KpiStat
                  label="Overdue credit"
                  value={fmtInr(overdueCredit)}
                  subtitle={
                    overdueCount === 0
                      ? `None over ${CREDIT_OVERDUE_DAYS} days`
                      : `${overdueCount} part${overdueCount === 1 ? 'y' : 'ies'}`
                  }
                  icon={CreditCardOutlinedIcon}
                  color={overdueCount > 0 ? 'secondary' : 'success'}
                  animateOnMount
                  staggerIndex={6}
                />
              </Grid>
            </>
          )}
        </Grid>

        <DashboardSection title="Shift performance">
          <TodaySalesByShiftSection pumpDayIso={reportIso} reportLabel={reportLabel} />
        </DashboardSection>

        <DashboardSection title="Cash & bank collections">
          <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <CashBankCollectionSummary pumpDayIso={reportIso} />
          </Paper>
        </DashboardSection>

        <DashboardSection title="Sales by fuel">
          <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <SalesByFuelChart pumpDayIso={reportIso} />
          </Paper>
        </DashboardSection>

        <DashboardSection title="Tank & inventory">
          <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <TankStockDipSummary pumpDayIso={reportIso} reportLabel={reportLabel} />
          </Paper>
        </DashboardSection>

        <DashboardSection title="Shift activity">
          <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <TodayShiftStatusSection pumpDayIso={reportIso} />
          </Paper>
        </DashboardSection>
      </Stack>
      <FloatingActionPanel actions={[...ownerQuickActions]} label="Shortcuts" />
    </>
  );
}
