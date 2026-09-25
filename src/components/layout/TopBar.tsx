import {
  AppBar,
  Box,
  Chip,
  IconButton,
  Toolbar,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { useNavigate } from 'react-router-dom';
import { StaffAvatar } from '@/components/ui/StaffAvatar';
import { useAuth } from '@/context/AuthContext';
import { roleLabel } from '@/utils/roles';

type Props = {
  onMenuClick: () => void;
  showMenuButton: boolean;
};

export function TopBar({ onMenuClick, showMenuButton }: Props) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    navigate('/login', { replace: true });
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StaffAvatar name={profile.name} photoUrl={profile.photoUrl} size={32} />
            <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                {profile.name}
              </Typography>
            </Box>
            <Chip label={roleLabel(profile.role)} size="small" color="primary" variant="outlined" />
            <IconButton onClick={handleLogout} aria-label="Sign out" color="inherit">
              <LogoutOutlinedIcon />
            </IconButton>
          </Box>
        ) : null}
      </Toolbar>
    </AppBar>
  );
}
