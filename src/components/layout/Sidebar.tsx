import {
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import { NavLink } from 'react-router-dom';
import type { NavGroup } from '@/config/navConfig';
import { DRAWER_WIDTH } from '@/theme/theme';

type Props = {
  groups: NavGroup[];
  onNavigate?: () => void;
};

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
          <Box key={group.label} sx={{ mb: 1 }}>
            <Typography
              variant="overline"
              sx={{ px: 2.5, py: 1, display: 'block', color: 'text.secondary', letterSpacing: '0.08em' }}
            >
              {group.label}
            </Typography>
            <List dense disablePadding>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <ListItemButton
                    key={item.to + item.label}
                    component={NavLink}
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    sx={{
                      mx: 1,
                      mb: 0.25,
                      borderRadius: 1.5,
                      minHeight: 44,
                      '&.active': {
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Icon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '0.925rem' }} />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
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
