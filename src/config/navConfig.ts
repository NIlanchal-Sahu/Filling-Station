import type { SvgIconComponent } from '@mui/icons-material';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import OpacityOutlinedIcon from '@mui/icons-material/OpacityOutlined';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import OilBarrelOutlinedIcon from '@mui/icons-material/OilBarrelOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import type { UserRole } from '@/types/entities';
import { homePathForRole } from '@/utils/roles';
import { hasPermission, type Permission } from '@/utils/permissions';

export type NavItem = {
  to: string;
  label: string;
  icon: SvgIconComponent;
  end?: boolean;
  permission: Permission;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        to: '__dashboard__',
        label: 'Dashboard',
        icon: DashboardOutlinedIcon,
        end: true,
        permission: 'view:dashboard',
      },
    ],
  },
  {
    label: 'Shifts',
    items: [
      {
        to: '/shifts/new',
        label: 'Start shift',
        icon: PlayCircleOutlineOutlinedIcon,
        permission: 'edit:shifts',
      },
    ],
  },
  {
    label: 'Fuel',
    items: [
      {
        to: '/manager/fuel-stock/daily',
        label: 'Daily dip',
        icon: OpacityOutlinedIcon,
        permission: 'view:operations',
      },
      {
        to: '/manager/fuel',
        label: 'Fuel prices',
        icon: LocalGasStationOutlinedIcon,
        permission: 'view:operations',
      },
      {
        to: '/manager/lubricants',
        label: 'Lubricants',
        icon: OilBarrelOutlinedIcon,
        permission: 'edit:fuel',
      },
      {
        to: '/manager/fuel-stock/purchase',
        label: 'Fuel purchase',
        icon: ShoppingCartOutlinedIcon,
        permission: 'edit:fuel',
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        to: '/manager/credit',
        label: 'Credit',
        icon: CreditCardOutlinedIcon,
        permission: 'view:credit',
      },
      {
        to: '/manager/ledger',
        label: 'Ledger',
        icon: AccountBalanceWalletOutlinedIcon,
        permission: 'view:ledger',
      },
      {
        to: '/manager/transfers',
        label: 'Transfers',
        icon: SwapHorizOutlinedIcon,
        permission: 'view:ledger',
      },
      {
        to: '/manager/daily-sheet',
        label: 'Daily sheet',
        icon: ReceiptLongOutlinedIcon,
        permission: 'view:ledger',
      },
    ],
  },
  {
    label: 'Operations',
    items: [
      {
        to: '/manager/reconciliations',
        label: 'Reconciliations',
        icon: FactCheckOutlinedIcon,
        permission: 'view:operations',
      },
      {
        to: '/manager/reports',
        label: 'Reports',
        icon: AssessmentOutlinedIcon,
        permission: 'view:reports',
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        to: '/admin/team',
        label: 'Team',
        icon: GroupsOutlinedIcon,
        permission: 'manage:team',
      },
      {
        to: '/admin/settings',
        label: 'Settings',
        icon: SettingsOutlinedIcon,
        permission: 'manage:settings',
      },
    ],
  },
];

function resolveDashboardPath(role: UserRole): string {
  return homePathForRole(role);
}

function resolveItemPath(item: NavItem, role: UserRole): string {
  if (item.to === '__dashboard__') {
    return resolveDashboardPath(role);
  }
  if (item.to === '/admin/team' && role !== 'admin') {
    return '/manager/team';
  }
  return item.to;
}

function itemVisibleForRole(item: NavItem, role: UserRole): boolean {
  if (!hasPermission(role, item.permission)) {
    return false;
  }
  if (role === 'owner' && item.permission.startsWith('edit:')) {
    return false;
  }
  return true;
}

export function getNavGroupsForRole(role: UserRole): NavGroup[] {
  if (role === 'operator') {
    return [
      {
        label: 'Overview',
        items: [
          {
            to: resolveDashboardPath(role),
            label: 'Home',
            icon: DashboardOutlinedIcon,
            end: true,
            permission: 'view:dashboard',
          },
        ],
      },
      {
        label: 'On duty',
        items: [
          {
            to: '/shifts/new',
            label: 'Start shift',
            icon: PlayCircleOutlineOutlinedIcon,
            permission: 'edit:shifts',
          },
          {
            to: '/operator/prices',
            label: 'Fuel prices',
            icon: LocalGasStationOutlinedIcon,
            permission: 'view:operations',
          },
        ],
      },
    ];
  }

  return NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.items
      .filter((item) => itemVisibleForRole(item, role))
      .map((item) => ({
        ...item,
        to: resolveItemPath(item, role),
      })),
  })).filter((group) => group.items.length > 0);
}

export function getMobileBottomNavItems(role: UserRole): NavItem[] {
  const dashboard: NavItem = {
    to: resolveDashboardPath(role),
    label: 'Home',
    icon: DashboardOutlinedIcon,
    end: true,
    permission: 'view:dashboard',
  };

  if (role === 'admin') {
    return [
      dashboard,
      {
        to: '/shifts/new',
        label: 'Shift',
        icon: PlayCircleOutlineOutlinedIcon,
        permission: 'edit:shifts',
      },
      {
        to: '/admin/team',
        label: 'Team',
        icon: GroupsOutlinedIcon,
        permission: 'manage:team',
      },
      {
        to: '/manager/reports',
        label: 'Reports',
        icon: AssessmentOutlinedIcon,
        permission: 'view:reports',
      },
    ];
  }

  if (role === 'owner') {
    return [
      dashboard,
      {
        to: '/manager/daily-sheet',
        label: 'Sheet',
        icon: ReceiptLongOutlinedIcon,
        permission: 'view:ledger',
      },
      {
        to: '/manager/credit',
        label: 'Credit',
        icon: CreditCardOutlinedIcon,
        permission: 'view:credit',
      },
      {
        to: '/manager/reconciliations',
        label: 'Recon',
        icon: FactCheckOutlinedIcon,
        permission: 'view:operations',
      },
    ];
  }

  if (role === 'manager') {
    return [
      dashboard,
      {
        to: '/shifts/new',
        label: 'Shift',
        icon: PlayCircleOutlineOutlinedIcon,
        permission: 'edit:shifts',
      },
      {
        to: '/manager/credit',
        label: 'Credit',
        icon: CreditCardOutlinedIcon,
        permission: 'edit:credit',
      },
      {
        to: '/manager/team',
        label: 'Team',
        icon: GroupsOutlinedIcon,
        permission: 'manage:team',
      },
      {
        to: '/manager/reports',
        label: 'Reports',
        icon: AssessmentOutlinedIcon,
        permission: 'view:reports',
      },
    ];
  }

  return [
    dashboard,
    {
      to: '/shifts/new',
      label: 'Shift',
      icon: PlayCircleOutlineOutlinedIcon,
      permission: 'edit:shifts',
    },
    {
      to: '/operator/prices',
      label: 'Prices',
      icon: LocalGasStationOutlinedIcon,
      permission: 'view:operations',
    },
  ];
}

export function flattenNavItems(role: UserRole): NavItem[] {
  return getNavGroupsForRole(role).flatMap((g) => g.items);
}
