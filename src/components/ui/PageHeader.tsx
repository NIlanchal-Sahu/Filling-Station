import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { MotionBox } from '@/components/motion/MotionBox';

type Props = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  /** Root wrapper styles (e.g. bottom margin when not inside a spaced Stack). */
  sx?: SxProps<Theme>;
};

export function PageHeader({ title, subtitle, action, sx }: Props) {
  return (
    <Box sx={sx}>
      <MotionBox preset="fade">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={{ xs: 1.5, sm: 2 }}
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 560 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
      </Stack>
      </MotionBox>
    </Box>
  );
}
