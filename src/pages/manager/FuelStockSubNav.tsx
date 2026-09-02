import { Tab, Tabs } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';

const TABS = [
  { label: 'Daily dip', path: '/manager/fuel-stock/daily' },
  { label: 'Purchase', path: '/manager/fuel-stock/purchase' },
] as const;

export function FuelStockSubNav() {
  const location = useLocation();
  const tabIndex = TABS.findIndex((t) => location.pathname.startsWith(t.path));
  const value = tabIndex >= 0 ? tabIndex : 0;

  return (
    <Tabs
      value={value}
      sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      variant="scrollable"
      allowScrollButtonsMobile
    >
      {TABS.map((t) => (
        <Tab
          key={t.path}
          label={t.label}
          component={RouterLink}
          to={t.path}
          sx={{ textTransform: 'none', fontWeight: 600, minHeight: 44 }}
        />
      ))}
    </Tabs>
  );
}
