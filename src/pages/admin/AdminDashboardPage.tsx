import { useEffect, useMemo, useState } from 'react';
import { Alert, Chip, Paper, Stack, TextField, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import OpacityOutlinedIcon from '@mui/icons-material/OpacityOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import { format, isSameDay } from 'date-fns';
import { DashboardSection } from '@/components/ui/DashboardSection';
import { KpiStat } from '@/components/ui/KpiStat';
import { KpiStatSkeleton } from '@/components/ui/KpiStatSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { QuickActionBar } from '@/components/ui/QuickActionBar';
import { listUsersForManager } from '@/services/usersService';
import { getShiftStatusForPumpDay } from '@/services/shiftStatusService';
import { TodayShiftStatusSection } from '@/pages/manager/TodayShiftStatusSection';
import { rememberAdminPumpDay, todayIso, withPumpDayQuery } from '@/utils/dateEntryPolicy';

function parseLocalYmd(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

export function AdminDashboardPage() {
  const liveTodayIso = todayIso();
  const maxSelectableIso = liveTodayIso;
  const [reportIso, setReportIso] = useState(liveTodayIso);

  const reportDay = useMemo(() => parseLocalYmd(reportIso), [reportIso]);
  const reportLabel = useMemo(
    () => (Number.isFinite(reportDay.getTime()) ? format(reportDay, 'dd MMM yyyy') : reportIso),
    [reportDay, reportIso],
  );
  const reportLabelShort = useMemo(
    () => (Number.isFinite(reportDay.getTime()) ? format(reportDay, 'dd-MM-yyyy') : reportIso),
    [reportDay, reportIso],
  );
  const isSelectedToday = Number.isFinite(reportDay.getTime()) && isSameDay(reportDay, new Date());

  const [kpisLoading, setKpisLoading] = useState(true);
  const [userCount, setUserCount] = useState(0);
  const [pendingReconToday, setPendingReconToday] = useState(0);
  const [openShiftsToday, setOpenShiftsToday] = useState(0);

  useEffect(() => {
    rememberAdminPumpDay(reportIso);
  }, [reportIso]);

  useEffect(() => {
    let ok = true;
    setKpisLoading(true);
    void (async () => {
      try {
        const [users, todayStatus] = await Promise.all([
          listUsersForManager(),
          getShiftStatusForPumpDay(liveTodayIso),
        ]);
        if (!ok) {
          return;
        }
        setUserCount(users.filter((u) => u.isActive).length);
        setPendingReconToday(todayStatus.totals.pendingReconciliation);
        setOpenShiftsToday(todayStatus.totals.active);
      } catch {
        if (ok) {
          setUserCount(0);
          setPendingReconToday(0);
          setOpenShiftsToday(0);
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
  }, [liveTodayIso]);

  function setPumpDay(iso: string) {
    const next = iso > maxSelectableIso ? maxSelectableIso : iso;
    setReportIso(next);
  }

  const workThisDay = [
    {
      to: withPumpDayQuery('/shifts/new', reportIso),
      label: 'Start shift',
      icon: <PlayCircleOutlineOutlinedIcon fontSize="small" />,
    },
    {
      to: withPumpDayQuery('/manager/credit', reportIso),
      label: 'Credit',
      icon: <CreditCardOutlinedIcon fontSize="small" />,
    },
    {
      to: withPumpDayQuery('/manager/fuel-stock/daily', reportIso),
      label: 'Daily dip',
      icon: <OpacityOutlinedIcon fontSize="small" />,
    },
    {
      to: withPumpDayQuery('/manager/daily-sheet', reportIso),
      label: 'Daily sheet',
      icon: <ReceiptLongOutlinedIcon fontSize="small" />,
    },
    {
      to: withPumpDayQuery('/manager/ledger', reportIso),
      label: 'Ledger',
      icon: <AccountBalanceWalletOutlinedIcon fontSize="small" />,
    },
    {
      to: '/manager/reconciliations',
      label: 'Reconciliations',
      icon: <FactCheckOutlinedIcon fontSize="small" />,
    },
    {
      to: withPumpDayQuery('/manager/reports', reportIso),
      label: 'Reports',
      icon: <AssessmentOutlinedIcon fontSize="small" />,
    },
  ];

  return (
    <Stack spacing={3} sx={{ pb: 4 }}>
      <PageHeader
        title="Admin dashboard"
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
              onChange={(e) => setPumpDay(e.target.value)}
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

      {!isSelectedToday ? (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          Editing {reportLabelShort} — this will change the books.
        </Alert>
      ) : null}

      <Grid container spacing={2}>
        {kpisLoading ? (
          <>
            <Grid size={{ xs: 6, sm: 4 }}>
              <KpiStatSkeleton />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <KpiStatSkeleton />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <KpiStatSkeleton />
            </Grid>
          </>
        ) : (
          <>
            <Grid size={{ xs: 6, sm: 4 }}>
              <KpiStat label="Active users" value={userCount} icon={GroupsOutlinedIcon} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <KpiStat label="Open shifts (today)" value={openShiftsToday} icon={PlayCircleOutlineOutlinedIcon} color="success" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <KpiStat
                label="Pending recon (today)"
                value={pendingReconToday}
                icon={FactCheckOutlinedIcon}
                color="warning"
              />
            </Grid>
          </>
        )}
      </Grid>

      <QuickActionBar actions={workThisDay} label="WORK THIS DAY" />

      <DashboardSection title="Shift status">
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <TodayShiftStatusSection
            pumpDayIso={reportIso}
            createShiftTo={withPumpDayQuery('/shifts/new', reportIso)}
          />
        </Paper>
      </DashboardSection>

      <DashboardSection title="Team & settings">
        <QuickActionBar
          label="ADMINISTRATION"
          actions={[
            { to: '/admin/team', label: 'Team', icon: <GroupsOutlinedIcon fontSize="small" /> },
            { to: '/admin/settings', label: 'Settings', icon: <SettingsOutlinedIcon fontSize="small" /> },
          ]}
        />
      </DashboardSection>
    </Stack>
  );
}
