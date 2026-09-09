import { alpha, Box, Paper, Typography } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';

type Props = {
  label: string;
  value: string | number;
  icon?: SvgIconComponent;
  subtitle?: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
};

export function KpiStat({ label, value, icon: Icon, subtitle, color = 'primary' }: Props) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.04em' }}>
            {label}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, letterSpacing: '-0.02em' }}>
            {value}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {Icon ? (
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: (t) => alpha(t.palette[color].main, 0.12),
              color: `${color}.main`,
            }}
          >
            <Icon fontSize="small" />
          </Box>
        ) : null}
      </Box>
    </Paper>
  );
}
