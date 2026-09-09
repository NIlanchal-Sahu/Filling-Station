import type { ReactNode } from 'react';
import { Button, Paper, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export type QuickAction = {
  to: string;
  label: string;
  icon?: ReactNode;
};

type Props = {
  actions: QuickAction[];
  label?: string;
};

export function QuickActionBar({ actions, label = 'QUICK ACTIONS' }: Props) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontWeight: 700, letterSpacing: '0.06em', display: 'block', mb: 1.25 }}
      >
        {label}
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {actions.map((a) => (
          <Button
            key={a.to}
            component={RouterLink}
            to={a.to}
            variant="outlined"
            size="small"
            startIcon={a.icon}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            {a.label}
          </Button>
        ))}
      </Stack>
    </Paper>
  );
}
