import type { ReactNode } from 'react';
import { Box, Paper, Typography } from '@mui/material';

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <Paper variant="outlined" sx={{ py: 6, px: 3, textAlign: 'center', borderRadius: 2 }}>
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
  );
}
