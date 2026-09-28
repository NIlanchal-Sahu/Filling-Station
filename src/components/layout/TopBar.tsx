import { useState } from 'react';
import {
  AppBar,
  Box,
  Chip,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import { useNavigate } from 'react-router-dom';
import { StaffAvatar } from '@/components/ui/StaffAvatar';
import { useAuth } from '@/context/AuthContext';
import { homePathForRole, roleLabel, parseUserRole } from '@/utils/roles';

type Props = {
  onMenuClick: () => void;
  showMenuButton: boolean;
};

export function TopBar({ onMenuClick, showMenuButton }: Props) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  async function handleLogout() {
    setAnchorEl(null);
    await signOut();
    navigate('/login', { replace: true });
  }

  function handleNotifications() {
    const role = parseUserRole(profile?.role);
    const home = homePathForRole(role);
    navigate(`${home}#attention`);
  }

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ gap: 1, minHeight: { xs: 56, sm: 64 } }}>
        {showMenuButton ? (
          <IconButton edge="start" onClick={onMenuClick} aria-label="Open menu" sx={{ mr: 0.5 }}>
            <MenuIcon />
          </IconButton>
        ) : null}
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700, fontSize: { xs: '1rem', sm: '1.15rem' } }}>
          PumpStock
        </Typography>
        {profile ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton onClick={handleNotifications} aria-label="Notifications and alerts" color="inherit" size="small">
              <NotificationsNoneOutlinedIcon />
            </IconButton>
            <IconButton
              onClick={(e) => setAnchorEl(e.currentTarget)}
              aria-label="Open profile menu"
              sx={{ p: 0.25 }}
            >
              <StaffAvatar name={profile.name} photoUrl={profile.photoUrl} size={32} />
            </IconButton>
            <Chip
              label={roleLabel(profile.role)}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ display: { xs: 'none', sm: 'flex' } }}
            />
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem disabled sx={{ opacity: 1 }}>
                <ListItemText
                  primary={profile.name}
                  secondary={roleLabel(profile.role)}
                  primaryTypographyProps={{ fontWeight: 700 }}
                />
              </MenuItem>
              <MenuItem onClick={() => void handleLogout()}>
                <ListItemIcon>
                  <LogoutOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>Log out</ListItemText>
              </MenuItem>
            </Menu>
          </Box>
        ) : null}
      </Toolbar>
    </AppBar>
  );
}
