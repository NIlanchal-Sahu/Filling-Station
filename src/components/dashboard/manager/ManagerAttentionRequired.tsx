import { useCallback, useEffect, useMemo, useState } from 'react';
import { alpha, Box, Chip, Stack, Typography } from '@mui/material';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import { getCashBankCollectionSummary } from '@/services/collectionSummaryService';
import { getShiftStatusForPumpDay } from '@/services/shiftStatusService';
import { getTankStockDaySummary } from '@/services/fuelStockReconciliationService';
import { getFuelStockOverview } from '@/services/fuelStockService';
import { getOverdueCreditSummary } from '@/services/aggregatesService';
import type { DashboardKpiData } from '@/hooks/useDashboardKpis';
import { SHIFT_STATUS_UPDATED_EVENT } from '@/utils/shiftStatusDisplay';
import { SHIFT_SALES_UPDATED_EVENT } from '@/utils/shiftSalesDisplay';
import { FUEL_STOCK_UPDATED_EVENT } from '@/utils/fuelStockDisplay';
import { VARIATION_ALERT_LITERS } from '@/utils/fuelStockConstants';
import { panelCardSx, panelTitleSx } from '@/components/dashboard/manager/dashboardPanelStyles';
import { shiftStatusLabel } from '@/utils/shiftStatusDisplay';

type Issue = {
  id: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
};

type Props = {
  pumpDayIso: string;
  kpiLoading: boolean;
  kpi: DashboardKpiData;
};

export function ManagerAttentionRequired({ pumpDayIso, kpiLoading, kpi }: Props) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const next: Issue[] = [];
    try {
      const [shiftStatus, collection, stockOverview, tankDay, overdue] = await Promise.all([
        getShiftStatusForPumpDay(pumpDayIso),
        getCashBankCollectionSummary(pumpDayIso, pumpDayIso),
        getFuelStockOverview(),
        getTankStockDaySummary(pumpDayIso).catch(() => null),
        getOverdueCreditSummary(),
      ]);

      for (const row of shiftStatus.rows) {
        if (row.status === 'not_started' || row.status === 'overdue') {
          next.push({
            id: `shift-${row.slot}`,
            message: `${row.displayName}: ${shiftStatusLabel(row.status)}`,
            severity: row.status === 'overdue' ? 'error' : 'warning',
          });
        } else if (row.status === 'reconciliation_pending') {
          next.push({
            id: `recon-${row.slot}`,
            message: `${row.displayName}: reconciliation pending`,
            severity: 'warning',
          });
        }
      }

      for (const msg of shiftStatus.alerts) {
        next.push({ id: `alert-${msg}`, message: msg, severity: 'warning' });
      }

      for (const msg of collection.alerts) {
        const lower = msg.toLowerCase();
        const severity = lower.includes('mismatch') || lower.includes('short') ? 'error' : 'warning';
        next.push({ id: `coll-${msg}`, message: msg, severity });
      }

      if (collection.pendingReconciliationShifts.length > 0 && kpi.pendingRecon > 0) {
        next.push({
          id: 'pending-recon',
          message: `${collection.pendingReconciliationShifts.length} shift(s) awaiting reconciliation`,
          severity: 'warning',
        });
      }

      const lowTanks = stockOverview.items.filter((i) => i.health === 'low' || i.health === 'critical');
      for (const t of lowTanks) {
        next.push({
          id: `stock-${t.fuelTypeId}`,
          message: `Low ${t.shortCode} stock (${Math.round(t.availablePercent)}% full)`,
          severity: t.health === 'critical' ? 'error' : 'warning',
        });
      }

      if (tankDay) {
        for (const row of tankDay.rows) {
          if (row.variationAlert && row.variationLiters != null && Math.abs(row.variationLiters) >= VARIATION_ALERT_LITERS) {
            next.push({
              id: `var-${row.shortCode}`,
              message: `${row.shortCode} dip variation ${row.variationLiters > 0 ? '+' : ''}${row.variationLiters.toLocaleString('en-IN')} L`,
              severity: 'warning',
            });
          }
        }
      }

      if (overdue.overdueCount > 0) {
        next.push({
          id: 'credit-overdue',
          message: `${overdue.overdueCount} credit ${overdue.overdueCount === 1 ? 'party' : 'parties'} overdue`,
          severity: 'warning',
        });
      }
    } catch {
      /* keep empty */
    } finally {
      setIssues(next);
      setLoading(false);
    }
  }, [pumpDayIso, kpi.pendingRecon]);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener(SHIFT_STATUS_UPDATED_EVENT, refresh);
    window.addEventListener(SHIFT_SALES_UPDATED_EVENT, refresh);
    window.addEventListener(FUEL_STOCK_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(SHIFT_STATUS_UPDATED_EVENT, refresh);
      window.removeEventListener(SHIFT_SALES_UPDATED_EVENT, refresh);
      window.removeEventListener(FUEL_STOCK_UPDATED_EVENT, refresh);
    };
  }, [load]);

  const uniqueIssues = useMemo(() => {
    const seen = new Set<string>();
    return issues.filter((i) => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    });
  }, [issues]);

  if (kpiLoading || loading) {
    return (
      <Box sx={{ ...panelCardSx, py: 2.5 }}>
        <Typography variant="body2" color="text.secondary">
          Checking operations…
        </Typography>
      </Box>
    );
  }

  if (uniqueIssues.length === 0) {
    return (
      <Box
        id="attention"
        sx={{
          ...panelCardSx,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: (t) => alpha(t.palette.success.main, t.palette.mode === 'dark' ? 0.12 : 0.06),
          borderColor: (t) => alpha(t.palette.success.main, 0.35),
        }}
      >
        <CheckCircleOutlineOutlinedIcon color="success" fontSize="small" />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          All operations are on track
        </Typography>
      </Box>
    );
  }

  const chipColor = (s: Issue['severity']) => (s === 'error' ? 'error' : s === 'warning' ? 'warning' : 'info');

  return (
    <Box id="attention" sx={panelCardSx}>
      <Typography sx={{ ...panelTitleSx, mb: 1.25 }}>Attention required</Typography>
      <Stack spacing={0.75}>
        {uniqueIssues.slice(0, 6).map((issue) => (
          <Stack key={issue.id} direction="row" spacing={1} alignItems="flex-start">
            <Chip size="small" label={issue.severity === 'error' ? '!' : '•'} color={chipColor(issue.severity)} sx={{ minWidth: 28, height: 22, '& .MuiChip-label': { px: 0.75 } }} />
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0, lineHeight: 1.45 }}>
              {issue.message}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
