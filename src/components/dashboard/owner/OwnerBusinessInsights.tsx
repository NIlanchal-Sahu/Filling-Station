import { useCallback, useEffect, useState } from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { DashboardInsightsPanel } from '@/components/dashboard/DashboardInsightsPanel';
import { getCashBankCollectionSummary } from '@/services/collectionSummaryService';
import { getShiftStatusForPumpDay } from '@/services/shiftStatusService';
import { CREDIT_OVERDUE_DAYS, getOverdueCreditSummary } from '@/services/aggregatesService';
import { fmtInrCompact, panelCardSx, panelTitleSx } from '@/components/dashboard/owner/ownerPanelStyles';

type Props = {
  pumpDayIso: string;
};

export function OwnerBusinessInsights({ pumpDayIso }: Props) {
  const [loading, setLoading] = useState(true);
  const [lines, setLines] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [coll, credit, shifts] = await Promise.all([
        getCashBankCollectionSummary(pumpDayIso, pumpDayIso),
        getOverdueCreditSummary(),
        getShiftStatusForPumpDay(pumpDayIso),
      ]);
      const next: string[] = [];
      if (coll.totalSales > 0.005) {
        next.push(
          `Collection efficiency ${coll.collectionEfficiencyPercent.toFixed(0)}% on ${fmtInrCompact(coll.totalCollection, 0)} collected`,
        );
      }
      if (credit.overdueCount > 0) {
        next.push(`${fmtInrCompact(credit.overdueAmount, 0)} overdue across ${credit.overdueCount} parties (${CREDIT_OVERDUE_DAYS}+ days)`);
      }
      const pending = shifts.totals.pendingReconciliation;
      if (pending > 0) {
        next.push(`${pending} shift reconciliation${pending === 1 ? '' : 's'} pending review`);
      }
      if (shifts.totals.active > 0) {
        next.push(`${shifts.totals.active} shift${shifts.totals.active === 1 ? '' : 's'} currently active`);
      }
      setLines(next);
    } finally {
      setLoading(false);
    }
  }, [pumpDayIso]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Stack spacing={2} sx={{ width: '100%', minWidth: 0 }}>
      {loading ? (
        <Box sx={{ ...panelCardSx, display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : lines.length > 0 ? (
        <Box sx={panelCardSx}>
          <Typography sx={{ ...panelTitleSx, mb: 1 }}>Business insights</Typography>
          <Stack spacing={0.5}>
            {lines.map((line) => (
              <Typography key={line} variant="body2" color="text.secondary">
                · {line}
              </Typography>
            ))}
          </Stack>
        </Box>
      ) : null}
      <DashboardInsightsPanel pumpDayIso={pumpDayIso} compact />
    </Stack>
  );
}
