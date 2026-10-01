import { useState } from 'react';
import {
  alpha,
  Button,
  IconButton,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import InstallMobileOutlinedIcon from '@mui/icons-material/InstallMobileOutlined';
import IosShareOutlinedIcon from '@mui/icons-material/IosShareOutlined';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { useStationAbout } from '@/context/StationAboutContext';
import { useThemeMode } from '@/context/ThemeModeContext';
import { marketingFontDisplay, marketingPalette } from '@/theme/marketingTheme';

type Props = {
  marketing?: boolean;
};

export function PwaInstallButton(props: Props) {
  const { marketing = false } = props;
  const { canNativeInstall, isIos, isStandalone, promptInstall } = usePwaInstall();
  const { profile: station } = useStationAbout();
  const { resolvedMode } = useThemeMode();
  const palette = marketingPalette(resolvedMode);
  const appName = station.displayName;
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  if (isStandalone) {
    return null;
  }

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (canNativeInstall) {
      void promptInstall();
      return;
    }
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => setAnchorEl(null);
  const open = Boolean(anchorEl);

  const label = canNativeInstall ? `Install ${appName} app` : `Install ${appName}`;

  const iconSx = marketing ? { color: palette.cyan } : undefined;

  return (
    <>
      <Tooltip title={label}>
        <IconButton size="small" onClick={handleClick} aria-label={label} sx={iconSx}>
          <InstallMobileOutlinedIcon />
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              p: 2,
              maxWidth: 320,
              borderRadius: 2.5,
              border: '1px solid',
              borderColor: palette.border,
              bgcolor: palette.bgElevated,
              boxShadow: `0 16px 48px ${alpha('#000', 0.25)}`,
            },
          },
        }}
      >
        <Stack spacing={1.5}>
          <Typography
            sx={{
              fontFamily: marketingFontDisplay,
              fontWeight: 700,
              fontSize: '1rem',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: palette.text,
            }}
          >
            Install app
          </Typography>
          {isIos ? (
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <IosShareOutlinedIcon sx={{ color: palette.cyan, fontSize: 20, mt: 0.25 }} />
              <Typography variant="body2" sx={{ color: palette.textMuted, lineHeight: 1.6 }}>
                In Safari, tap Share, then <strong>Add to Home Screen</strong>.
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body2" sx={{ color: palette.textMuted, lineHeight: 1.6 }}>
              In Chrome or Edge, open the browser menu and choose <strong>Install {appName}</strong>, or use the
              install icon in the address bar when it appears.
            </Typography>
          )}
          {canNativeInstall ? (
            <Button
              variant="contained"
              size="small"
              startIcon={<InstallMobileOutlinedIcon />}
              onClick={() => {
                void promptInstall();
                handleClose();
              }}
              sx={{
                alignSelf: 'flex-start',
                borderRadius: 999,
                textTransform: 'none',
                fontWeight: 700,
                bgcolor: palette.cyan,
                color: palette.bg,
                '&:hover': { bgcolor: palette.blue },
              }}
            >
              Install now
            </Button>
          ) : null}
        </Stack>
      </Popover>
    </>
  );
}
