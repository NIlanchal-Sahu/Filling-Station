import { alpha, Box, Container, Typography } from '@mui/material';
import LocalGasStationOutlinedIcon from '@mui/icons-material/LocalGasStationOutlined';
import { createPortal } from 'react-dom';
import { useStationAbout } from '@/context/StationAboutContext';
import { useThemeMode } from '@/context/ThemeModeContext';
import { marketingFontDisplay, marketingPalette } from '@/theme/marketingTheme';

type Props = {
  actions: React.ReactNode;
};

/** Reserve space below the fixed marketing header. */
export const marketingTopBarPad = { xs: 7, sm: 7.5 };

export function MarketingTopBar({ actions }: Props) {
  const { profile: station } = useStationAbout();
  const { resolvedMode } = useThemeMode();
  const palette = marketingPalette(resolvedMode);

  const bar = (
    <Box
      component="header"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: (theme) => theme.zIndex.drawer + 2,
        borderBottom: '1px solid',
        borderColor: palette.border,
        bgcolor: alpha(palette.bg, 0.72),
        backdropFilter: 'blur(16px)',
        pt: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <Container maxWidth="lg" sx={{ py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <LocalGasStationOutlinedIcon sx={{ color: palette.cyan, fontSize: 28 }} />
        <Typography
          sx={{
            flex: 1,
            fontFamily: marketingFontDisplay,
            fontWeight: 700,
            fontSize: '1.35rem',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {station.displayName}
        </Typography>
        {actions}
      </Container>
    </Box>
  );

  if (typeof document === 'undefined') {
    return bar;
  }

  return createPortal(bar, document.body);
}
