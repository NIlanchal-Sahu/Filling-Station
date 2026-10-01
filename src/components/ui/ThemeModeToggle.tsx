import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined';
import { useState } from 'react';
import { useThemeMode, type ThemeModePreference } from '@/context/ThemeModeContext';

type Props = {
  /** Quick toggle only (icon button). */
  variant?: 'toggle' | 'menu';
  size?: 'small' | 'medium';
  /** For marketing headers (light icon on dark bar). */
  marketing?: boolean;
};

export function ThemeModeToggle(props: Props) {
  const { variant = 'toggle', size = 'small', marketing = false } = props;
  const { preference, resolvedMode, setPreference, toggleLightDark } = useThemeMode();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const iconSx = marketing
    ? { color: resolvedMode === 'dark' ? '#e8edf7' : '#0d47a1' }
    : undefined;

  if (variant === 'menu') {
    return (
      <>
        <Tooltip title="Appearance">
          <IconButton
            size={size}
            onClick={(e) => setAnchorEl(e.currentTarget)}
            aria-label="Theme appearance"
            sx={iconSx}
          >
            {resolvedMode === 'dark' ? <DarkModeOutlinedIcon /> : <LightModeOutlinedIcon />}
          </IconButton>
        </Tooltip>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          {(
            [
              ['light', 'Light', <LightModeOutlinedIcon key="l" fontSize="small" />],
              ['dark', 'Dark', <DarkModeOutlinedIcon key="d" fontSize="small" />],
              ['system', 'System', <SettingsBrightnessOutlinedIcon key="s" fontSize="small" />],
            ] as const
          ).map(([mode, label, icon]) => (
            <MenuItem
              key={mode}
              selected={preference === mode}
              onClick={() => {
                setPreference(mode as ThemeModePreference);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon>{icon}</ListItemIcon>
              <ListItemText>{label}</ListItemText>
            </MenuItem>
          ))}
        </Menu>
      </>
    );
  }

  return (
    <Tooltip title={resolvedMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
      <IconButton size={size} onClick={toggleLightDark} aria-label="Toggle light or dark mode" sx={iconSx}>
        {resolvedMode === 'dark' ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
      </IconButton>
    </Tooltip>
  );
}
