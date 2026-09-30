import { Fragment, useCallback, useMemo, useState } from 'react';
import { Paper, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import { format, isSameDay } from 'date-fns';

import { useDashboardKpis } from '@/hooks/useDashboardKpis';
import { SalesByFuelChart } from '@/pages/manager/SalesByFuelChart';
import { ManagerDashboardHeader } from '@/components/dashboard/manager/ManagerDashboardHeader';
import { ManagerOverviewKpis } from '@/components/dashboard/manager/ManagerOverviewKpis';
import { ManagerAttentionRequired } from '@/components/dashboard/manager/ManagerAttentionRequired';
import { ManagerQuickActions } from '@/components/dashboard/manager/ManagerQuickActions';
import { ManagerShiftOverview } from '@/components/dashboard/manager/ManagerShiftOverview';
import { ManagerSalesFuelSummary } from '@/components/dashboard/manager/ManagerSalesFuelSummary';
import { ManagerCollectionsSummary } from '@/components/dashboard/manager/ManagerCollectionsSummary';
import { ManagerFuelStockSummary } from '@/components/dashboard/manager/ManagerFuelStockSummary';
import { ManagerCreditSummary } from '@/components/dashboard/manager/ManagerCreditSummary';
import { ManagerRecentActivity } from '@/components/dashboard/manager/ManagerRecentActivity';
import { OwnerBusinessPerformance } from '@/components/dashboard/owner/OwnerBusinessPerformance';
import { OwnerBusinessInsights } from '@/components/dashboard/owner/OwnerBusinessInsights';
import { OwnerDetailedReports } from '@/components/dashboard/owner/OwnerDetailedReports';
import { FloatingActionPanel } from '@/components/ui/FloatingActionPanel';
import { getManagerMobileShortcuts } from '@/config/dashboardMobileShortcuts';
function parseLocalYmd(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

export function ManagerDashboardPage() {
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

  const { loading: kpisLoading, data: kpiData } = useDashboardKpis(reportIso, refreshKey);
  const mobileShortcuts = useMemo(() => getManagerMobileShortcuts(reportIso), [reportIso]);

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
          pb: { xs: 12, sm: 10, md: 5 },
          overflowX: 'hidden',
        }}
      >
        <ManagerDashboardHeader
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

        <ManagerOverviewKpis
          key={`kpis-${reportIso}-${refreshKey}`}
          pumpDayIso={reportIso}
          loading={kpisLoading}
          data={kpiData}
        />

        <ManagerAttentionRequired key={`attn-${reportIso}-${refreshKey}`} pumpDayIso={reportIso} />

        <ManagerQuickActions pumpDayIso={reportIso} />

        <Grid container spacing={2.5} sx={{ width: '100%', minWidth: 0 }}>
          <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <OwnerBusinessPerformance key={`perf-${reportIso}-${refreshKey}`} pumpDayIso={reportIso} />
            <ManagerSalesFuelSummary key={`sales-fuel-${reportIso}-${refreshKey}`} pumpDayIso={reportIso} />
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
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'text.secondary',
                  fontSize: '0.68rem',
                  display: 'block',
                  mb: 1.5,
                }}
              >
                SALES ANALYTICS
              </Typography>
              <SalesByFuelChart pumpDayIso={reportIso} />
            </Paper>
            <ManagerFuelStockSummary key={`inventory-${reportIso}-${refreshKey}`} pumpDayIso={reportIso} />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <ManagerCreditSummary key={`credit-${refreshKey}`} />
            <ManagerCollectionsSummary key={`collections-${reportIso}-${refreshKey}`} pumpDayIso={reportIso} />
            <ManagerShiftOverview key={`shifts-${reportIso}-${refreshKey}`} pumpDayIso={reportIso} />
          </Grid>
        </Grid>

        <OwnerBusinessInsights key={`insights-${reportIso}-${refreshKey}`} pumpDayIso={reportIso} />

        <OwnerDetailedReports pumpDayIso={reportIso} />

        <ManagerRecentActivity key={`activity-${reportIso}-${refreshKey}`} pumpDayIso={reportIso} />
      </Stack>
      <FloatingActionPanel actions={mobileShortcuts} label="Shortcuts" />
    </Fragment>
  );
}
