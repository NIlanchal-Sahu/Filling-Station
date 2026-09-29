import { useCallback, useEffect, useState } from 'react';
import { alpha, Box, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import { getCashBankCollectionSummary } from '@/services/collectionSummaryService';
import { getShiftStatusForPumpDay } from '@/services/shiftStatusService';
import {
  CREDIT_OVERDUE_DAYS,
  getOverdueCreditSummary,
  getPumpDaySalesOverview,
} from '@/services/aggregatesService';
import { fmtInrCompact } from '@/components/dashboard/owner/ownerPanelStyles';

type InsightType = 'error' | 'warning' | 'info' | 'success';

type InsightItem = {
  id: string;
  type: InsightType;
  text: string;
};

type Props = {
  pumpDayIso: string;
};

function getIndicator(type: InsightType) {
  switch (type) {
    case 'error':
      return { dotColor: 'error.main', label: '🔴' };
    case 'warning':
      return { dotColor: 'warning.main', label: '🟠' };
    case 'success':
      return { dotColor: 'success.main', label: '🟢' };
    case 'info':
    default:
      return { dotColor: 'info.main', label: 'ℹ' };
  }
}

export function OwnerBusinessInsights({ pumpDayIso }: Props) {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<InsightItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [coll, credit, shifts, sales] = await Promise.all([
        getCashBankCollectionSummary(pumpDayIso, pumpDayIso),
        getOverdueCreditSummary(),
        getShiftStatusForPumpDay(pumpDayIso),
        getPumpDaySalesOverview(pumpDayIso),
      ]);

      const items: InsightItem[] = [];

      // 1. Critical credit alerts
      if (credit.overdueCount > 0) {
        items.push({
          id: 'credit-overdue',
          type: 'error',
          text: `${fmtInrCompact(credit.overdueAmount, 0)} overdue across ${credit.overdueCount} ${
            credit.overdueCount === 1 ? 'party' : 'parties'
          } (${CREDIT_OVERDUE_DAYS}+ days)`,
        });
      }

      // 2. Cash shortage alerts
      if (sales.shortageAmount > 0.005) {
        items.push({
          id: 'shortage',
          type: 'error',
          text: `Cash shortage of ${fmtInrCompact(sales.shortageAmount, 0)} flagged on reconciliation`,
        });
      }

      // 3. Shift attention alerts
      const overdueShifts = shifts.rows.filter((r) => r.status === 'overdue').length;
      const pendingRecon = shifts.totals.pendingReconciliation;
      const shiftAlertCount = overdueShifts + pendingRecon;
      if (shiftAlertCount > 0) {
        const parts: string[] = [];
        if (overdueShifts > 0) parts.push(`${overdueShifts} overdue`);
        if (pendingRecon > 0) parts.push(`${pendingRecon} pending review`);
        items.push({
          id: 'shifts-attn',
          type: 'warning',
          text: `${shiftAlertCount} shift${shiftAlertCount === 1 ? '' : 's'} require attention (${parts.join(', ')})`,
        });
      }

      // 4. Sales status
      if (sales.meterSalesAmount <= 0.005) {
        items.push({
          id: 'sales-empty',
          type: 'info',
          text: 'No reconciled fuel sales recorded yet for this pump day',
        });
      } else if (coll.totalCollection > 0) {
        items.push({
          id: 'coll-eff',
          type: 'success',
          text: `Collection efficiency at ${Math.round(coll.collectionEfficiencyPercent)}% on ${fmtInrCompact(coll.totalCollection, 0)} collected`,
        });
      }

      // 5. Active shifts
      if (shifts.totals.active > 0) {
        items.push({
          id: 'shifts-active',
          type: 'info',
          text: `${shifts.totals.active} shift currently active and recording meter throughput`,
        });
      }

      setInsights(items);
    } finally {
      setLoading(false);
    }
  }, [pumpDayIso]);

  useEffect(() => {
    void load();
  }, [load]);

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
        <CircularProgress size={20} />
      </Paper>
    );
  }

  if (insights.length === 0) return null;

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.25 },
        borderRadius: 3.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: (t) =>
          t.palette.mode === 'dark' ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.03)',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'text.secondary',
            fontSize: '0.68rem',
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
          }}
        >
          <LightbulbOutlinedIcon sx={{ fontSize: 16, color: 'warning.main' }} />
          BUSINESS INSIGHTS
        </Typography>
      </Stack>

      <Stack spacing={1}>
        {insights.map((item) => {
          const { dotColor } = getIndicator(item.type);
          return (
            <Stack
              key={item.id}
              direction="row"
              spacing={1.25}
              alignItems="flex-start"
              sx={{
                py: 0.85,
                px: 1.25,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: (t) =>
                  t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.04) : '#f8fafc',
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: dotColor,
                  mt: 0.65,
                  flexShrink: 0,
                }}
              />
              <Typography
                variant="body2"
                sx={{
                  color: 'text.primary',
                  fontWeight: 600,
                  fontSize: { xs: '0.82rem', sm: '0.85rem' },
                  lineHeight: 1.4,
                }}
              >
                {item.text}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Paper>
  );
}
