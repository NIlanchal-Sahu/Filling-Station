import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { alpha, Box, Button, Collapse, Paper, Stack, Typography } from '@mui/material';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import {
  CREDIT_OVERDUE_DAYS,
  getOverdueCreditSummary,
  getPumpDaySalesOverview,
} from '@/services/aggregatesService';
import { getCashBankCollectionSummary } from '@/services/collectionSummaryService';
import { getShiftStatusForPumpDay } from '@/services/shiftStatusService';
import { getFuelStockOverview } from '@/services/fuelStockService';
import { getPumpDayOpeningVariationByFuel } from '@/services/pumpDayDipVariationService';
import { SHIFT_STATUS_UPDATED_EVENT } from '@/utils/shiftStatusDisplay';
import { SHIFT_SALES_UPDATED_EVENT } from '@/utils/shiftSalesDisplay';
import { FUEL_STOCK_UPDATED_EVENT } from '@/utils/fuelStockDisplay';
import { withPumpDayQuery } from '@/utils/dateEntryPolicy';
import { fmtInrCompact } from '@/components/dashboard/owner/ownerPanelStyles';
import {
  collectFuelVariationAlerts,
  fuelVariationReportPath,
} from '@/components/dashboard/owner/ownerFuelVariation';

export type ActionItem = {
  id: string;
  title: string;
  detail?: string;
  actionText: string;
  to: string;
  severity: 'error' | 'warning';
};

type Props = {
  pumpDayIso: string;
};

export function OwnerAttentionRequired({ pumpDayIso }: Props) {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const next: ActionItem[] = [];
    try {
      const [sales, collection, credit, shiftStatus, stockOverview, variationRows] = await Promise.all([
        getPumpDaySalesOverview(pumpDayIso),
        getCashBankCollectionSummary(pumpDayIso, pumpDayIso),
        getOverdueCreditSummary(),
        getShiftStatusForPumpDay(pumpDayIso),
        getFuelStockOverview(),
        getPumpDayOpeningVariationByFuel(pumpDayIso).catch(() => []),
      ]);

      if (sales.shortageAmount > 0.005) {
        next.push({
          id: 'shortage',
          title: 'Cash mismatch / shortage',
          detail: `${fmtInrCompact(sales.shortageAmount, 0)} on this pump day`,
          actionText: 'Review recon →',
          to: withPumpDayQuery('/manager/reconciliations', pumpDayIso),
          severity: 'error',
        });
      }

      if (credit.overdueCount > 0) {
        next.push({
          id: 'credit-overdue',
          title: `${credit.overdueCount} credit ${credit.overdueCount === 1 ? 'party' : 'parties'} overdue`,
          detail: `${fmtInrCompact(credit.overdueAmount, 0)} • ${CREDIT_OVERDUE_DAYS}+ days`,
          actionText: 'Review credit →',
          to: '/manager/credit',
          severity: 'error',
        });
      }

      for (const row of shiftStatus.rows) {
        if (row.status === 'overdue') {
          next.push({
            id: `shift-overdue-${row.slot}`,
            title: `${row.displayName} overdue`,
            detail: 'Shift closing meters pending',
            actionText: 'View shift →',
            to: withPumpDayQuery('/owner/shift-activity', pumpDayIso),
            severity: 'warning',
          });
        } else if (row.status === 'reconciliation_pending') {
          next.push({
            id: `recon-${row.slot}`,
            title: `${row.displayName} reconciliation pending`,
            detail: 'Closed shift awaits manager review',
            actionText: 'Review recon →',
            to: withPumpDayQuery('/manager/reconciliations', pumpDayIso),
            severity: 'warning',
          });
        }
      }

      for (const msg of collection.alerts) {
        const lower = msg.toLowerCase();
        const isCritical = lower.includes('mismatch') || lower.includes('short');
        next.push({
          id: `coll-${msg}`,
          title: isCritical ? 'Collection mismatch' : 'Collection alert',
          detail: msg,
          actionText: 'Daily sheet →',
          to: withPumpDayQuery('/manager/daily-sheet', pumpDayIso),
          severity: isCritical ? 'error' : 'warning',
        });
      }

      for (const t of stockOverview.items.filter((i) => i.health === 'low' || i.health === 'critical')) {
        next.push({
          id: `low-${t.fuelTypeId}`,
          title: `Low ${t.shortCode} stock`,
          detail: `${Math.round(t.availablePercent)}% capacity (${Math.round(t.currentStockLiters).toLocaleString('en-IN')} L)`,
          actionText: 'View stock →',
          to: withPumpDayQuery('/manager/fuel-stock/daily', pumpDayIso),
          severity: t.health === 'critical' ? 'error' : 'warning',
        });
      }

      const variationAlerts = collectFuelVariationAlerts(variationRows);
      if (variationAlerts.length > 0) {
        next.unshift({
          id: 'fuel-variation',
          title: 'Fuel variation detected',
          detail: variationAlerts.map((v) => v.label).join(' • '),
          actionText: 'View Variation →',
          to: fuelVariationReportPath(pumpDayIso),
          severity: 'error',
        });
      }
    } catch {
      /* empty */
    } finally {
      // Sort error (critical) first, then warning
      next.sort((a, b) => (a.severity === 'error' ? -1 : 1) - (b.severity === 'error' ? -1 : 1));
      setItems(next);
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

  const uniqueItems = useMemo(() => {
    const seen = new Set<string>();
    return items.filter((i) => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    });
  }, [items]);

  if (loading) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 3.5,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Checking operational exceptions…
        </Typography>
      </Paper>
    );
  }

  if (uniqueItems.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          py: 1.5,
          px: 2,
          borderRadius: 3.5,
          border: '1px solid',
          borderColor: (t) => alpha(t.palette.success.main, 0.3),
          bgcolor: (t) => alpha(t.palette.success.main, t.palette.mode === 'dark' ? 0.08 : 0.04),
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
        }}
      >
        <CheckCircleOutlineOutlinedIcon color="success" sx={{ fontSize: 20 }} />
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
          All operations on track · No critical alerts
        </Typography>
      </Paper>
    );
  }

  const initialItems = uniqueItems.slice(0, 3);
  const remainingItems = uniqueItems.slice(3);

  const renderItemRow = (item: ActionItem) => {
    const isError = item.severity === 'error';
    return (
      <Stack
        key={item.id}
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1.5}
        sx={{
          py: 1,
          px: 1.25,
          borderRadius: 2,
          bgcolor: (t) =>
            alpha(isError ? t.palette.error.main : t.palette.warning.main, t.palette.mode === 'dark' ? 0.08 : 0.04),
          border: '1px solid',
          borderColor: (t) =>
            alpha(isError ? t.palette.error.main : t.palette.warning.main, 0.2),
          transition: 'background-color 0.15s ease',
          '&:hover': {
            bgcolor: (t) =>
              alpha(isError ? t.palette.error.main : t.palette.warning.main, t.palette.mode === 'dark' ? 0.14 : 0.08),
          },
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              flexShrink: 0,
              bgcolor: isError ? 'error.main' : 'warning.main',
              boxShadow: (t) =>
                `0 0 0 2px ${alpha(isError ? t.palette.error.main : t.palette.warning.main, 0.2)}`,
            }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                color: 'text.primary',
                fontSize: { xs: '0.82rem', sm: '0.875rem' },
                lineHeight: 1.25,
              }}
              noWrap
            >
              {item.title}
            </Typography>
            {item.detail ? (
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.72rem',
                  display: 'block',
                  mt: 0.2,
                }}
                noWrap
              >
                {item.detail}
              </Typography>
            ) : null}
          </Box>
        </Stack>

        <Button
          component={RouterLink}
          to={item.to}
          size="small"
          variant="text"
          sx={{
            flexShrink: 0,
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.78rem',
            py: 0.25,
            px: 1,
            color: isError ? 'error.main' : 'warning.dark',
            borderRadius: 1.5,
            whiteSpace: 'nowrap',
            '&:hover': {
              bgcolor: (t) =>
                alpha(isError ? t.palette.error.main : t.palette.warning.main, 0.12),
            },
          }}
        >
          {item.actionText}
        </Button>
      </Stack>
    );
  };

  return (
    <Paper
      id="attention"
      elevation={0}
      sx={{
        p: { xs: 1.75, sm: 2 },
        borderRadius: 3.5,
        border: '1px solid',
        borderColor: (t) => alpha(t.palette.warning.main, 0.4),
        bgcolor: 'background.paper',
        boxShadow: (t) =>
          t.palette.mode === 'dark' ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.03)',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
        <Box>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'text.secondary',
              display: 'block',
              fontSize: '0.68rem',
            }}
          >
            ATTENTION REQUIRED
          </Typography>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              color: 'warning.main',
              fontSize: '0.85rem',
              mt: 0.15,
            }}
          >
            {uniqueItems.length} {uniqueItems.length === 1 ? 'item needs' : 'items need'} attention
          </Typography>
        </Box>
      </Stack>

      <Stack spacing={1}>
        {initialItems.map(renderItemRow)}

        {remainingItems.length > 0 ? (
          <>
            <Collapse in={showAll} unmountOnExit>
              <Stack spacing={1} sx={{ mt: 1 }}>
                {remainingItems.map(renderItemRow)}
              </Stack>
            </Collapse>
            <Button
              size="small"
              onClick={() => setShowAll((prev) => !prev)}
              endIcon={showAll ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.78rem',
                color: 'text.secondary',
                alignSelf: 'flex-start',
                mt: 0.5,
                p: 0.5,
              }}
            >
              {showAll ? 'Show less' : `View all (${uniqueItems.length}) →`}
            </Button>
          </>
        ) : null}
      </Stack>
    </Paper>
  );
}
