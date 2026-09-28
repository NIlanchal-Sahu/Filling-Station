import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
} from '@mui/material';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { flattenNavItems } from '@/config/navConfig';
import { parseUserRole } from '@/utils/roles';
import { panelCardSx } from '@/components/dashboard/manager/dashboardPanelStyles';

type HubKind = 'operations' | 'menu';

const OPERATIONS_TO = new Set([
  '/shifts/new',
  '/manager/sales',
  '/manager/shift-activity',
  '/manager/fuel-stock/daily',
  '/manager/daily-sheet',
  '/manager/reconciliations',
  '/manager/credit',
]);

const MENU_TO = new Set([
  '/manager/credit',
  '/manager/team',
  '/manager/ledger',
  '/manager/transfers',
  '/manager/fuel',
  '/manager/lubricants',
  '/manager/fuel-stock/purchase',
  '/manager/reports',
]);

function ManagerMobileHubPage({ kind }: { kind: HubKind }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const role = parseUserRole(profile?.role);
  const all = flattenNavItems(role);
  const allowed = kind === 'operations' ? OPERATIONS_TO : MENU_TO;
  const links = all.filter((item) => allowed.has(item.to));

  const title = kind === 'operations' ? 'Operations' : 'Menu';
  const subtitle =
    kind === 'operations'
      ? 'Sales, shifts, dip, and collections'
      : 'Credit, team, ledger, and settings';

  async function handleLogout() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <Stack spacing={2.5} sx={{ width: '100%', minWidth: 0, pb: { xs: 10, md: 4 } }}>
      <PageHeader title={title} subtitle={subtitle} />
      <Box sx={panelCardSx}>
        <List disablePadding dense>
          {links.map((item) => {
            const Icon = item.icon;
            return (
              <ListItemButton key={item.to + item.label} component={RouterLink} to={item.to} sx={{ borderRadius: 1.5 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 600 }} />
              </ListItemButton>
            );
          })}
        </List>
      </Box>
      {kind === 'menu' ? (
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<LogoutOutlinedIcon />}
          onClick={() => void handleLogout()}
          sx={{ alignSelf: 'flex-start', borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Log out
        </Button>
      ) : null}
    </Stack>
  );
}

export function ManagerOperationsHubPage() {
  return <ManagerMobileHubPage kind="operations" />;
}

export function ManagerMenuHubPage() {
  return <ManagerMobileHubPage kind="menu" />;
}
