import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Link, Paper, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import { format } from 'date-fns';
import { DashboardSection } from '@/components/ui/DashboardSection';
import { KpiStat } from '@/components/ui/KpiStat';
import { KpiStatSkeleton } from '@/components/ui/KpiStatSkeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { LOCAL_DEMO, EXPLICIT_LOCAL_DEMO } from '@/config/appMode';
import { listUsersForManager } from '@/services/usersService';
import { getShiftStatusForPumpDay } from '@/services/shiftStatusService';

export function AdminDashboardPage() {
  const todayIso = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [userCount, setUserCount] = useState(0);
  const [pendingRecon, setPendingRecon] = useState(0);

  useEffect(() => {
    let ok = true;
    setKpisLoading(true);
    void (async () => {
      try {
        const [users, shiftStatus] = await Promise.all([
          listUsersForManager(),
          getShiftStatusForPumpDay(todayIso),
        ]);
        if (!ok) {
          return;
        }
        setUserCount(users.filter((u) => u.isActive).length);
        setPendingRecon(shiftStatus.totals.pendingReconciliation);
      } catch {
        if (ok) {
          setUserCount(0);
          setPendingRecon(0);
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
  }, [todayIso]);

  const modeLabel = LOCAL_DEMO ? (EXPLICIT_LOCAL_DEMO ? 'Local demo' : 'Demo (no Firebase)') : 'Firebase';

  return (
    <Stack spacing={3} sx={{ pb: 4 }}>
      <PageHeader
        title="Admin dashboard"
        subtitle="System overview, team management, and deployment settings."
      />

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
              <KpiStat label="Environment" value={modeLabel} icon={CloudOutlinedIcon} color="secondary" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <KpiStat
                label="Pending reconciliations"
                value={pendingRecon}
                icon={FactCheckOutlinedIcon}
                color="warning"
              />
            </Grid>
          </>
        )}
      </Grid>

      <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Quick links
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Button component={RouterLink} to="/admin/team" variant="contained" startIcon={<GroupsOutlinedIcon />}>
            Team
          </Button>
          <Button component={RouterLink} to="/admin/settings" variant="outlined" startIcon={<SettingsOutlinedIcon />}>
            Settings
          </Button>
          <Button component={RouterLink} to="/manager/reports" variant="outlined" startIcon={<AssessmentOutlinedIcon />}>
            Reports
          </Button>
        </Stack>
      </Paper>

      <DashboardSection title="Activity log" subtitle="System audit trail for user and operational events.">
        <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 1.5 }}>
            <HistoryOutlinedIcon color="action" sx={{ mt: 0.25 }} />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Activity log
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 560 }}>
                Coming soon — user actions, role changes, and reconciliation approvals will appear here.
              </Typography>
            </Box>
          </Stack>
          <Button variant="outlined" disabled startIcon={<HistoryOutlinedIcon />}>
            View log
          </Button>
        </Paper>
      </DashboardSection>

      <DashboardSection title="Resources" subtitle="Documentation and deployment references.">
        <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <MenuBookOutlinedIcon fontSize="small" color="action" />
              <Link component={RouterLink} to="/admin/settings" underline="hover" sx={{ fontWeight: 600 }}>
                Admin settings
              </Link>
              <Typography variant="body2" color="text.secondary">
                — environment and Firebase configuration
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <MenuBookOutlinedIcon fontSize="small" color="action" />
              <Link
                href="https://github.com/NIlanchal-Sahu/Filling-Station/blob/main/docs/ROLES.md"
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                sx={{ fontWeight: 600 }}
              >
                Roles & permissions
              </Link>
              <Typography variant="body2" color="text.secondary">
                — role matrix and route access
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <RocketLaunchOutlinedIcon fontSize="small" color="action" />
              <Link
                href="https://github.com/NIlanchal-Sahu/Filling-Station/blob/main/docs/DEPLOYMENT.md"
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                sx={{ fontWeight: 600 }}
              >
                Deployment guide
              </Link>
              <Typography variant="body2" color="text.secondary">
                — Vercel, Firebase, and bootstrap script
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ pt: 0.5 }}>
              Bootstrap: run <code>node scripts/bootstrap-firebase.mjs</code> after setting SEED_* credentials in .env.
            </Typography>
          </Stack>
        </Paper>
      </DashboardSection>

      <Box>
        <Typography variant="body2" color="text.secondary">
          Admin accounts manage users, roles, and environment configuration. Day-to-day pump operations are handled by managers and workers.
        </Typography>
      </Box>
    </Stack>
  );
}
