import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { MotionBox } from '@/components/motion/MotionBox';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  contentReady?: boolean;
  id?: string;
};

export function DashboardSection({ title, subtitle, children, contentReady = true, id }: Props) {
  return (
    <Box component="section" id={id} sx={id ? { scrollMarginTop: { xs: 72, sm: 88 } } : undefined}>
      <Stack spacing={0.5} sx={{ mb: 2 }}>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ fontWeight: 700, letterSpacing: '0.1em', lineHeight: 1.4 }}
        >
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Stack>
      {contentReady ? (
        <MotionBox preset="fadeUp" transition={{ duration: 0.3 }} key="content">
          {children}
        </MotionBox>
      ) : null}
    </Box>
  );
}
