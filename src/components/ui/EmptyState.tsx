import type { ReactNode } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { MotionBox } from '@/components/motion/MotionBox';
import { HeroImage } from '@/components/ui/HeroImage';

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  illustration?: 'empty-shift';
};

export function EmptyState({ icon, title, description, action, illustration }: Props) {
  return (
    <MotionBox preset="fadeUp">
      <Paper variant="outlined" sx={{ py: 6, px: 3, textAlign: 'center', borderRadius: 2, overflow: 'hidden' }}>
        {illustration === 'empty-shift' ? (
          <Box
            sx={{
              maxWidth: 320,
              mx: 'auto',
              mb: 2,
              borderRadius: 2,
              overflow: 'hidden',
              aspectRatio: '16/9',
            }}
          >
            <HeroImage
              webpSrc="/hero/empty-shift.webp"
              fallbackSvg="/hero/empty-shift-fallback.svg"
              alt=""
            />
          </Box>
        ) : null}
        {icon ? <Box sx={{ mb: 1.5, color: 'text.secondary' }}>{icon}</Box> : null}
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {description ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 400, mx: 'auto' }}>
            {description}
          </Typography>
        ) : null}
        {action ? <Box sx={{ mt: 2 }}>{action}</Box> : null}
      </Paper>
    </MotionBox>
  );
}
