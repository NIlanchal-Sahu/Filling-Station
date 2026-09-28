import type { SxProps, Theme } from '@mui/material';

export const panelCardSx: SxProps<Theme> = {
  p: 2,
  borderRadius: 2,
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
};

/** Fill grid cell height on paired desktop rows */
export const panelStretchSx: SxProps<Theme> = {
  ...panelCardSx,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
};

export const OWNER_DASHBOARD_PANEL_MIN_H = 200;

export const panelTitleSx: SxProps<Theme> = {
  fontWeight: 700,
  letterSpacing: '0.06em',
  fontSize: '0.68rem',
  textTransform: 'uppercase',
  color: 'text.secondary',
};

export function fmtInrCompact(n: number, fraction = 0): string {
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  })}`;
}
