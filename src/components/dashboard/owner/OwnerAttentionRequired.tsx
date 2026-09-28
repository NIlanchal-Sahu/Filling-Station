import { useCallback, useEffect, useMemo, useState } from 'react';
import { alpha, Box, Stack, Typography } from '@mui/material';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import {
  CREDIT_OVERDUE_DAYS,
  getOverdueCreditSummary,
  getPumpDaySalesOverview,
} from '@/services/aggregatesService';
import { getCashBankCollectionSummary } from '@/services/collectionSummaryService';
import { getShiftStatusForPumpDay } from '@/services/shiftStatusService';
import { getFuelStockOverview } from '@/services/fuelStockService';
import { getTankStockDaySummary } from '@/services/fuelStockReconciliationService';
import { SHIFT_STATUS_UPDATED_EVENT, shiftStatusLabel } from '@/utils/shiftStatusDisplay';
import { SHIFT_SALES_UPDATED_EVENT } from '@/utils/shiftSalesDisplay';
import { FUEL_STOCK_UPDATED_EVENT } from '@/utils/fuelStockDisplay';
import { VARIATION_ALERT_LITERS } from '@/utils/fuelStockConstants';
import {
  fmtInrCompact,
  OWNER_DASHBOARD_PANEL_MIN_H,
  panelStretchSx,
  panelTitleSx,
} from '@/components/dashboard/owner/ownerPanelStyles';

type Issue = { id: string; message: string; severity: 'error' | 'warning' | 'info' };

type Props = {
  pumpDayIso: string;
};

export function OwnerAttentionRequired({ pumpDayIso }: Props) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const next: Issue[] = [];
    try {
      const [sales, collection, credit, shiftStatus, stockOverview, tankDay] = await Promise.all([
        getPumpDaySalesOverview(pumpDayIso),
        getCashBankCollectionSummary(pumpDayIso, pumpDayIso),
        getOverdueCreditSummary(),
        getShiftStatusForPumpDay(pumpDayIso),
        getFuelStockOverview(),
        getTankStockDaySummary(pumpDayIso).catch(() => null),
      ]);

      if (sales.shortageAmount > 0.005) {
        next.push({
          id: 'shortage',
          message: `Cash mismatch / shortage ${fmtInrCompact(sales.shortageAmount, 0)} on this pump day`,
          severity: 'error',
        });
      }

      if (credit.overdueCount > 0) {
        next.push({
          id: 'credit-overdue',
          message: `${credit.overdueCount} credit ${credit.overdueCount === 1 ? 'party' : 'parties'} unpaid for ${CREDIT_OVERDUE_DAYS}+ days (${fmtInrCompact(credit.overdueAmount, 0)})`,
          severity: 'warning',
        });
      }

      for (const msg of collection.alerts) {
        const lower = msg.toLowerCase();
        next.push({
          id: `coll-${msg}`,
          message: msg,
          severity: lower.includes('mismatch') || lower.includes('short') ? 'error' : 'warning',
        });
      }

      if (collection.pendingReconciliationShifts.length > 0) {
        next.push({
          id: 'pending-recon',
          message: `${collection.pendingReconciliationShifts.length} shift(s) pending reconciliation`,
          severity: 'warning',
        });
      }

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

      for (const t of stockOverview.items.filter((i) => i.health === 'low' || i.health === 'critical')) {
        next.push({
          id: `low-${t.fuelTypeId}`,
          message: `Low ${t.shortCode} stock (${Math.round(t.availablePercent)}% of capacity)`,
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
    } catch {
      /* empty */
    } finally {
      setIssues(next);
      setLoading(false);
    }
  }, [pumpDayIso]);

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

  const unique = useMemo(() => {
    const seen = new Set<string>();
    return issues.filter((i) => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    });
  }, [issues]);

  if (loading) {
    return (
      <Box sx={{ ...panelStretchSx, minHeight: OWNER_DASHBOARD_PANEL_MIN_H, justifyContent: 'center', py: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Reviewing exceptions…
        </Typography>
      </Box>
    );
  }

  if (unique.length === 0) {
    return (
      <Box
        id="attention"
        sx={{
          ...panelStretchSx,
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

  return (
    <Box id="attention" sx={panelStretchSx}>
      <Typography sx={{ ...panelTitleSx, mb: 1.25 }}>Attention required</Typography>
      <Stack spacing={0.75} sx={{ flex: 1 }}>
        {unique.slice(0, 8).map((issue) => (
          <Stack key={issue.id} direction="row" spacing={1} alignItems="flex-start">
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                mt: 0.65,
                flexShrink: 0,
                bgcolor:
                  issue.severity === 'error'
                    ? 'error.main'
                    : issue.severity === 'warning'
                      ? 'warning.main'
                      : 'info.main',
              }}
            />
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0, lineHeight: 1.45 }}>
              {issue.message}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
