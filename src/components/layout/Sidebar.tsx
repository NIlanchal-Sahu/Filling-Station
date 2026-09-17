import { useEffect } from 'react';
import {
  Box,
  Collapse,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import type { NavGroup } from '@/config/navConfig';
import { DRAWER_WIDTH } from '@/theme/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useSidebarGroupState } from '@/hooks/useSidebarGroupState';

type Props = {
  groups: NavGroup[];
  onNavigate?: () => void;
};

function isItemActive(pathname: string, to: string, end?: boolean): boolean {
  return end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
}

function NavItem({
  to,
  end,
  label,
  icon: Icon,
  onNavigate,
}: {
  to: string;
  end?: boolean;
  label: string;
  icon: NavGroup['items'][number]['icon'];
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const reduced = useReducedMotion();
  const active = isItemActive(location.pathname, to, end);

  return (
    <ListItemButton
      component={NavLink}
      to={to}
      end={end}
      onClick={onNavigate}
      sx={{
        mx: 1,
        mb: 0.25,
        borderRadius: 1.5,
        minHeight: 44,
        position: 'relative',
        overflow: 'hidden',
        '&.active': {
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
        },
      }}
    >
      {!reduced && active ? (
        <motion.div
          layoutId="sidebar-active-bar"
          style={{
            position: 'absolute',
            left: 0,
            top: '20%',
            bottom: '20%',
            width: 3,
            borderRadius: '0 2px 2px 0',
            backgroundColor: '#fff',
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      ) : null}
      <ListItemIcon sx={{ minWidth: 40 }}>
        <Icon fontSize="small" />
      </ListItemIcon>
      <ListItemText primary={label} primaryTypographyProps={{ fontSize: '0.925rem' }} />
    </ListItemButton>
  );
}

function CollapsibleNavGroup({
  group,
  onNavigate,
}: {
  group: NavGroup;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const hasActiveChild = group.items.some((item) => isItemActive(location.pathname, item.to, item.end));
  const collapsible = group.items.length > 1;
  const [open, setOpen] = useSidebarGroupState(group.label, hasActiveChild || group.label === 'Overview');

  useEffect(() => {
    if (hasActiveChild) {
      setOpen(true);
    }
  }, [hasActiveChild, location.pathname, setOpen]);

  if (!collapsible) {
    return (
      <Box sx={{ mb: 0.5 }}>
        {group.items.map((item) => (
          <NavItem
            key={item.to + item.label}
            to={item.to}
            end={item.end}
            label={item.label}
            icon={item.icon}
            onNavigate={onNavigate}
          />
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 0.5 }}>
      <ListItemButton
        onClick={() => setOpen(!open)}
        sx={{
          mx: 1,
          mb: 0.25,
          borderRadius: 1.5,
          minHeight: 36,
          py: 0.75,
          color: 'text.secondary',
        }}
      >
        <ListItemText
          primary={group.label}
          primaryTypographyProps={{
            variant: 'overline',
            sx: { fontWeight: 700, letterSpacing: '0.08em', lineHeight: 1.4 },
          }}
        />
        <ExpandMoreOutlinedIcon
          sx={{
            fontSize: 18,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List dense disablePadding>
          {group.items.map((item) => (
            <NavItem
              key={item.to + item.label}
              to={item.to}
              end={item.end}
              label={item.label}
              icon={item.icon}
              onNavigate={onNavigate}
            />
          ))}
        </List>
      </Collapse>
    </Box>
  );
}

export function SidebarNav({ groups, onNavigate }: Props) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 2.5, py: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LocalGasStationOutlinedIcon />
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            PumpStock
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Filling station ops
          </Typography>
        </Box>
      </Box>
      <Divider />
      <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
        {groups.map((group) => (
          <CollapsibleNavGroup key={group.label} group={group} onNavigate={onNavigate} />
        ))}
      </Box>
    </Box>
  );
}

type SidebarProps = Props;

export function Sidebar({ groups }: SidebarProps) {
  return (
    <Box
      component="nav"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        display: { xs: 'none', md: 'block' },
        borderRight: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
      }}
    >
      <SidebarNav groups={groups} />
    </Box>
  );
}

export { SidebarNav as SidebarDrawerContent };
