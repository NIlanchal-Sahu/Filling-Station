import { Fragment, useCallback, useMemo, useState } from 'react';
import { Stack } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { format, isSameDay } from 'date-fns';
import { OwnerDashboardHeader } from '@/components/dashboard/owner/OwnerDashboardHeader';
import { OwnerOverviewKpis } from '@/components/dashboard/owner/OwnerOverviewKpis';
import { OwnerAttentionRequired } from '@/components/dashboard/owner/OwnerAttentionRequired';
import { OwnerCreditAttention } from '@/components/dashboard/owner/OwnerCreditAttention';
import { OwnerBusinessPerformance } from '@/components/dashboard/owner/OwnerBusinessPerformance';
import { OwnerSalesFuelSummary } from '@/components/dashboard/owner/OwnerSalesFuelSummary';
import { OwnerCollectionsSummary } from '@/components/dashboard/owner/OwnerCollectionsSummary';
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
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [refreshKey, setRefreshKey] = useState(0);

  const maxSelectableIso = format(new Date(), 'yyyy-MM-dd');
  const reportDay = useMemo(() => parseLocalYmd(reportIso), [reportIso]);
  const reportLabel = useMemo(
    () => (Number.isFinite(reportDay.getTime()) ? format(reportDay, 'dd MMM yyyy') : reportIso),
    [reportDay, reportIso],
  );
  const isSelectedToday = Number.isFinite(reportDay.getTime()) && isSameDay(reportDay, new Date());
  const mobileShortcuts = useMemo(() => getOwnerMobileShortcuts(reportIso), [reportIso]);

  const handleRefresh = useCallback(() => {
    setLastUpdated(new Date());
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <Fragment>
      <Stack
        spacing={2.5}
        sx={{
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          // Priority 1: generous bottom padding so the last card is fully visible above fixed bottom nav and FAB
          pb: { xs: 12, sm: 10, md: 5 },
          overflowX: 'hidden',
        }}
      >
        {/* Header with compact date selector and last updated / refresh */}
        <OwnerDashboardHeader
          reportLabel={reportLabel}
          isSelectedToday={isSelectedToday}
          reportIso={reportIso}
          maxSelectableIso={maxSelectableIso}
          onReportIsoChange={(iso) => {
            setReportIso(iso);
            setLastUpdated(new Date());
          }}
          lastUpdated={lastUpdated}
          onRefresh={handleRefresh}
        />

        {/* Priority 2: 4 Primary KPI Cards */}
        <OwnerOverviewKpis key={`kpis-${reportIso}-${refreshKey}`} pumpDayIso={reportIso} />

        {/* Priority 4: Attention Required Action Center */}
        <OwnerAttentionRequired key={`attn-${reportIso}-${refreshKey}`} pumpDayIso={reportIso} />

        {/* Desktop Multi-column Layout: 2-column paired grid on md+ screens */}
        <Grid container spacing={2.5} sx={{ width: '100%', minWidth: 0 }}>
          {/* Column 1: Performance, Sales by Fuel, Fuel & Inventory */}
          <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <OwnerBusinessPerformance
              key={`perf-${reportIso}-${refreshKey}`}
              pumpDayIso={reportIso}
            />
            <OwnerSalesFuelSummary
              key={`sales-fuel-${reportIso}-${refreshKey}`}
              pumpDayIso={reportIso}
            />
            <OwnerFuelInventorySummary
              key={`inventory-${reportIso}-${refreshKey}`}
              pumpDayIso={reportIso}
            />
          </Grid>

          {/* Column 2: Credit Overview, Collections Breakdown, Shift Overview */}
          <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <OwnerCreditAttention key={`credit-${refreshKey}`} />
            <OwnerCollectionsSummary
              key={`collections-${reportIso}-${refreshKey}`}
              pumpDayIso={reportIso}
            />
            <OwnerShiftOverview
              key={`shifts-${reportIso}-${refreshKey}`}
              pumpDayIso={reportIso}
            />
          </Grid>
        </Grid>

        {/* Priority 12: Business Insights ABOVE Detailed Reports */}
        <OwnerBusinessInsights
          key={`insights-${reportIso}-${refreshKey}`}
          pumpDayIso={reportIso}
        />

        {/* Priority 11: Categorized Detailed Reports */}
        <OwnerDetailedReports pumpDayIso={reportIso} />
      </Stack>

      <FloatingActionPanel actions={mobileShortcuts} label="Shortcuts" />
    </Fragment>
  );
}
