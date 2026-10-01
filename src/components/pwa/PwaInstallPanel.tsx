import { alpha, Box, Button, Stack, Typography } from '@mui/material';
import IosShareOutlinedIcon from '@mui/icons-material/IosShareOutlined';
import InstallMobileOutlinedIcon from '@mui/icons-material/InstallMobileOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import { motion } from 'motion/react';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useThemeMode } from '@/context/ThemeModeContext';
import { marketingFontDisplay, marketingPalette } from '@/theme/marketingTheme';

export function PwaInstallPanel() {
  const { canNativeInstall, isIos, isStandalone, showInstallUi, promptInstall } = usePwaInstall();
  const reduced = useReducedMotion();
  const { resolvedMode } = useThemeMode();
  const MARKETING = marketingPalette(resolvedMode);

  if (isStandalone) {
    return (
      <Box
        sx={{
          p: 2,
          borderRadius: 3,
          border: '1px solid',
          borderColor: alpha(MARKETING.cyan, 0.35),
          bgcolor: alpha(MARKETING.cyan, 0.08),
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <CheckCircleOutlineOutlinedIcon sx={{ color: MARKETING.cyan }} />
        <Typography variant="body2" sx={{ color: MARKETING.text, fontWeight: 600 }}>
          PumpStock is installed on this device.
        </Typography>
      </Box>
    );
  }

  if (!showInstallUi) {
    return null;
  }

  const Wrapper = reduced ? 'div' : motion.div;

  return (
    <Wrapper
      {...(!reduced && {
        initial: { opacity: 0, y: 12 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-24px' },
        transition: { duration: 0.45, delay: 0.1 },
      })}
    >
      <Box
        id="pwa-install"
        sx={{
          p: { xs: 2.5, sm: 3 },
          borderRadius: 3,
          border: '1px solid',
          borderColor: MARKETING.border,
          bgcolor: MARKETING.glassStrong,
          backdropFilter: 'blur(14px)',
          boxShadow: `0 0 40px ${alpha(MARKETING.cyan, 0.08)}`,
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
              <InstallMobileOutlinedIcon sx={{ color: MARKETING.cyan }} />
              <Typography
                sx={{
                  fontFamily: marketingFontDisplay,
                  fontWeight: 700,
                  fontSize: '1.2rem',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Install app
              </Typography>
            </Stack>
            {canNativeInstall ? (
              <Typography variant="body2" sx={{ color: MARKETING.textMuted, lineHeight: 1.65, maxWidth: 520 }}>
                Add PumpStock to your home screen for quick access on the forecourt — works like a native app.
              </Typography>
            ) : isIos ? (
              <Typography variant="body2" sx={{ color: MARKETING.textMuted, lineHeight: 1.65, maxWidth: 520 }}>
                On iPhone or iPad: tap <strong>Share</strong> <IosShareOutlinedIcon sx={{ fontSize: 16, verticalAlign: 'middle' }} /> then{' '}
                <strong>Add to Home Screen</strong>.
              </Typography>
            ) : (
              <Typography variant="body2" sx={{ color: MARKETING.textMuted, lineHeight: 1.65 }}>
                On desktop or Android: open in Chrome or Edge over HTTPS, then use the install icon in the address bar or
                browser menu → <strong>Install PumpStock</strong>. Works on phone home screen and desktop like an app.
              </Typography>
            )}
          </Box>
          {canNativeInstall ? (
            <Button
              variant="contained"
              size="large"
              startIcon={<InstallMobileOutlinedIcon />}
              onClick={() => void promptInstall()}
              sx={{
                flexShrink: 0,
                borderRadius: 999,
                px: 3,
                fontWeight: 700,
                textTransform: 'none',
                bgcolor: MARKETING.violet,
                color: MARKETING.text,
                boxShadow: `0 0 28px ${alpha(MARKETING.violet, 0.35)}`,
                '&:hover': { bgcolor: MARKETING.blue },
              }}
            >
              Install PumpStock
            </Button>
          ) : null}
        </Stack>
      </Box>
    </Wrapper>
  );
}
