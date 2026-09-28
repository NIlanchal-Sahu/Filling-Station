import { Fragment, useMemo, useState } from 'react';
import { Stack } from '@mui/material';
import { format, isSameDay } from 'date-fns';
import { OwnerDashboardHeader } from '@/components/dashboard/owner/OwnerDashboardHeader';
import { OwnerOverviewKpis } from '@/components/dashboard/owner/OwnerOverviewKpis';
import { OwnerAttentionRequired } from '@/components/dashboard/owner/OwnerAttentionRequired';
import { OwnerCreditAttention } from '@/components/dashboard/owner/OwnerCreditAttention';
import { OwnerBusinessPerformance } from '@/components/dashboard/owner/OwnerBusinessPerformance';
import { OwnerSalesFuelSummary } from '@/components/dashboard/owner/OwnerSalesFuelSummary';
import { ManagerCollectionsSummary } from '@/components/dashboard/manager/ManagerCollectionsSummary';
import { OwnerFuelInventorySummary } from '@/components/dashboard/owner/OwnerFuelInventorySummary';
import { OwnerShiftOverview } from '@/components/dashboard/owner/OwnerShiftOverview';
import { OwnerBusinessInsights } from '@/components/dashboard/owner/OwnerBusinessInsights';
import { OwnerDetailedReports } from '@/components/dashboard/owner/OwnerDetailedReports';
import { FloatingActionPanel } from '@/components/ui/FloatingActionPanel';
import { getOwnerMobileShortcuts } from '@/config/dashboardMobileShortcuts';

function parseLocalYmd(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

export function OwnerDashboardPage() {
  const [reportIso, setReportIso] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const maxSelectableIso = format(new Date(), 'yyyy-MM-dd');
  const reportDay = useMemo(() => parseLocalYmd(reportIso), [reportIso]);
  const reportLabel = useMemo(
    () => (Number.isFinite(reportDay.getTime()) ? format(reportDay, 'dd MMM yyyy') : reportIso),
    [reportDay, reportIso],
  );
  const isSelectedToday = Number.isFinite(reportDay.getTime()) && isSameDay(reportDay, new Date());
  const mobileShortcuts = useMemo(() => getOwnerMobileShortcuts(reportIso), [reportIso]);

  return (
    <Fragment>
    <Stack
      spacing={2.5}
      sx={{
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        pb: { xs: 10, md: 4 },
        overflowX: 'hidden',
      }}
    >
      <OwnerDashboardHeader
        reportLabel={reportLabel}
        isSelectedToday={isSelectedToday}
        reportIso={reportIso}
        maxSelectableIso={maxSelectableIso}
        onReportIsoChange={setReportIso}
      />

      <OwnerOverviewKpis pumpDayIso={reportIso} />

      <OwnerAttentionRequired pumpDayIso={reportIso} />
      <OwnerBusinessPerformance pumpDayIso={reportIso} />
      <OwnerCreditAttention />
      <OwnerSalesFuelSummary pumpDayIso={reportIso} />
      <ManagerCollectionsSummary pumpDayIso={reportIso} />
      <OwnerFuelInventorySummary pumpDayIso={reportIso} />
      <OwnerShiftOverview pumpDayIso={reportIso} />
      <OwnerDetailedReports pumpDayIso={reportIso} />
      <OwnerBusinessInsights pumpDayIso={reportIso} />
    </Stack>
    <FloatingActionPanel actions={mobileShortcuts} label="Shortcuts" />
    </Fragment>
  );
}
