import { Fragment, useMemo, useState } from 'react';

import {
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';

import { format, isSameDay } from 'date-fns';

import { LOCAL_DEMO } from '@/config/appMode';
import { DashboardSection } from '@/components/ui/DashboardSection';
import { DashboardInsightsPanel } from '@/components/dashboard/DashboardInsightsPanel';
import { useDashboardKpis } from '@/hooks/useDashboardKpis';
import { demoResetStores } from '@/localDemo/demoBackend';
import { SalesByFuelChart } from '@/pages/manager/SalesByFuelChart';
import { ManagerDashboardHeader } from '@/components/dashboard/manager/ManagerDashboardHeader';
import { ManagerOverviewKpis } from '@/components/dashboard/manager/ManagerOverviewKpis';
import { ManagerAttentionRequired } from '@/components/dashboard/manager/ManagerAttentionRequired';
import { ManagerQuickActions } from '@/components/dashboard/manager/ManagerQuickActions';
import { ManagerShiftStatusCompact } from '@/components/dashboard/manager/ManagerShiftStatusCompact';
import { ManagerTodaySalesSummary } from '@/components/dashboard/manager/ManagerTodaySalesSummary';
import { ManagerCollectionsSummary } from '@/components/dashboard/manager/ManagerCollectionsSummary';
import { ManagerFuelStockSummary } from '@/components/dashboard/manager/ManagerFuelStockSummary';
import { ManagerCreditSummary } from '@/components/dashboard/manager/ManagerCreditSummary';
import { ManagerRecentActivity } from '@/components/dashboard/manager/ManagerRecentActivity';
import { FloatingActionPanel } from '@/components/ui/FloatingActionPanel';
import { getManagerMobileShortcuts } from '@/config/dashboardMobileShortcuts';

function parseLocalYmd(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

export function ManagerDashboardPage() {
  const [reportIso, setReportIso] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const maxSelectableIso = format(new Date(), 'yyyy-MM-dd');
  const reportDay = useMemo(() => parseLocalYmd(reportIso), [reportIso]);
  const reportLabel = useMemo(
    () => (Number.isFinite(reportDay.getTime()) ? format(reportDay, 'dd MMM yyyy') : reportIso),
    [reportDay, reportIso],
  );
  const isSelectedToday = Number.isFinite(reportDay.getTime()) && isSameDay(reportDay, new Date());

  const { loading: kpisLoading, data: kpiData } = useDashboardKpis(reportIso);
  const mobileShortcuts = useMemo(() => getManagerMobileShortcuts(reportIso), [reportIso]);

  return (
    <Fragment>
    <Stack
      spacing={2.5}
      sx={{
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        pb: { xs: 10, md: 4 },
      }}
    >
      <ManagerDashboardHeader
        reportLabel={reportLabel}
        isSelectedToday={isSelectedToday}
        reportIso={reportIso}
        maxSelectableIso={maxSelectableIso}
        onReportIsoChange={setReportIso}
      />

      <ManagerOverviewKpis pumpDayIso={reportIso} loading={kpisLoading} data={kpiData} />

      <ManagerAttentionRequired pumpDayIso={reportIso} kpiLoading={kpisLoading} kpi={kpiData} />

      <ManagerQuickActions pumpDayIso={reportIso} />

      <ManagerShiftStatusCompact pumpDayIso={reportIso} />

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        sx={{ width: '100%', minWidth: 0, alignItems: 'stretch' }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <ManagerTodaySalesSummary pumpDayIso={reportIso} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <ManagerCollectionsSummary pumpDayIso={reportIso} />
        </Box>
      </Stack>

      <ManagerFuelStockSummary pumpDayIso={reportIso} />

      <ManagerCreditSummary />

      <DashboardSection
        title="Insights"
        subtitle="Charts for the selected pump day — tap through for full reports."
        contentReady={!kpisLoading}
      >
        <DashboardInsightsPanel pumpDayIso={reportIso} compact />
      </DashboardSection>

      <DashboardSection
        title="Sales analytics"
        subtitle="Revenue and volume by fuel type."
        contentReady={!kpisLoading}
      >
        <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <SalesByFuelChart pumpDayIso={reportIso} />
        </Paper>
      </DashboardSection>

      <ManagerRecentActivity pumpDayIso={reportIso} />

      {LOCAL_DEMO ? (
        <Card
          elevation={0}
          sx={{
            borderRadius: 2,
            border: '2px dashed',
            borderColor: 'warning.light',
            bgcolor: (t) => alpha(t.palette.warning.main, 0.06),
          }}
        >
          <CardContent sx={{ pt: 2.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <RestartAltOutlinedIcon color="warning" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'warning.dark' }}>
                Local demo reset
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720, lineHeight: 1.7 }}>
              Clears shifts, readings, reconciliations, ledger, and credit in this browser, then restores starter setup.
            </Typography>
            <Button
              variant="contained"
              color="warning"
              startIcon={<RestartAltOutlinedIcon />}
              onClick={() => {
                if (!window.confirm('Reset all local demo data in this browser? This cannot be undone.')) return;
                demoResetStores();
                window.location.reload();
              }}
              sx={{ borderRadius: 2 }}
            >
              Reset to initial demo state
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
    <FloatingActionPanel actions={mobileShortcuts} label="Shortcuts" />
    </Fragment>
  );
}
