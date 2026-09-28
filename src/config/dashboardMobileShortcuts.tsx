import type { ReactNode } from 'react';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import OpacityOutlinedIcon from '@mui/icons-material/OpacityOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PlayCircleOutlineOutlinedIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import type { QuickAction } from '@/components/ui/QuickActionBar';
import { withPumpDayQuery } from '@/utils/dateEntryPolicy';

type ActionDef = {
  path: string;
  label: string;
  icon: ReactNode;
  withDay?: boolean;
};

const MANAGER_ACTION_DEFS: ActionDef[] = [
  { path: '/manager/credit', label: 'Sale', icon: <AddOutlinedIcon />, withDay: true },
  { path: '/manager/credit', label: 'Credit', icon: <CreditCardOutlinedIcon />, withDay: true },
  { path: '/shifts/new', label: 'Shift', icon: <PlayCircleOutlineOutlinedIcon />, withDay: true },
  { path: '/manager/fuel-stock/daily', label: 'Dip', icon: <OpacityOutlinedIcon />, withDay: true },
  { path: '/manager/daily-sheet', label: 'Collection', icon: <PaymentsOutlinedIcon />, withDay: true },
  { path: '/manager/reports', label: 'Reports', icon: <AssessmentOutlinedIcon /> },
];

const OWNER_ACTION_DEFS: ActionDef[] = [
  { path: '/manager/daily-sheet', label: 'Daily cash sheet', icon: <ReceiptLongOutlinedIcon />, withDay: true },
  { path: '/manager/credit', label: 'Credit register', icon: <CreditCardOutlinedIcon /> },
  { path: '/manager/reconciliations', label: 'Reconciliation', icon: <FactCheckOutlinedIcon /> },
  { path: '/manager/reports', label: 'Reports', icon: <AssessmentOutlinedIcon /> },
  { path: '/manager/fuel-stock/daily', label: 'Fuel stock', icon: <OpacityOutlinedIcon />, withDay: true },
];

function toQuickActions(defs: ActionDef[], pumpDayIso: string): QuickAction[] {
  return defs.map((d) => ({
    label: d.label,
    to: d.withDay ? withPumpDayQuery(d.path, pumpDayIso) : d.path,
    icon: d.icon,
  }));
}

export function getManagerMobileShortcuts(pumpDayIso: string): QuickAction[] {
  return toQuickActions(MANAGER_ACTION_DEFS, pumpDayIso);
}

export function getOwnerMobileShortcuts(pumpDayIso: string): QuickAction[] {
  return toQuickActions(OWNER_ACTION_DEFS, pumpDayIso);
}
