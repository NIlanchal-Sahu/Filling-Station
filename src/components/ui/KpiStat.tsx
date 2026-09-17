import { alpha, Box, Paper, Typography } from '@mui/material';
import { motion } from 'motion/react';
import { Link as RouterLink } from 'react-router-dom';
import type { SvgIconComponent } from '@mui/icons-material';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type Props = {
  label: string;
  value: string | number;
  icon?: SvgIconComponent;
  subtitle?: string;
  hint?: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  animateOnMount?: boolean;
  staggerIndex?: number;
  to?: string;
  onClick?: () => void;
};

export function KpiStat({
  label,
  value,
  icon: Icon,
  subtitle,
  hint,
  color = 'primary',
  animateOnMount = false,
  staggerIndex = 0,
  to,
  onClick,
}: Props) {
  const reduced = useReducedMotion();
  const useStagger = !reduced && staggerIndex > 0;
  const useIconPop = !reduced && animateOnMount && Icon;
  const interactive = Boolean(to || onClick);

  const content = (
    <Paper
      elevation={0}
      component={to ? RouterLink : onClick ? 'button' : 'div'}
      {...(to ? { to } : {})}
      {...(onClick ? { onClick, type: 'button' as const } : {})}
      sx={{
        p: 2,
        height: '100%',
        width: '100%',
        display: 'block',
        textAlign: 'left',
        textDecoration: 'none',
        color: 'inherit',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        cursor: interactive ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease, transform 0.15s ease',
        ...(interactive && {
          '&:hover': {
            borderColor: (t) => alpha(t.palette[color].main, 0.45),
            boxShadow: (t) => `0 8px 24px ${alpha(t.palette[color].main, 0.12)}`,
            transform: reduced ? 'none' : 'translateY(-2px)',
          },
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 2,
          },
        }),
        ...(onClick && {
          bgcolor: 'background.paper',
          font: 'inherit',
        }),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: '0.04em' }}>
            {label}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {subtitle}
            </Typography>
          ) : null}
          {interactive && hint ? (
            <StackHint hint={hint} />
          ) : null}
        </Box>
        {Icon ? (
          <Box
            component={useIconPop ? motion.div : 'div'}
            {...(useIconPop && {
              initial: { scale: 0.85, opacity: 0 },
              animate: { scale: 1, opacity: 1 },
              transition: { type: 'spring', stiffness: 400, damping: 18, delay: staggerIndex * 0.08 + 0.1 },
            })}
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: (t) => alpha(t.palette[color].main, 0.12),
              color: `${color}.main`,
              flexShrink: 0,
            }}
          >
            <Icon fontSize="small" />
          </Box>
        ) : null}
      </Box>
    </Paper>
  );

  const wrapped = useStagger ? (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: staggerIndex * 0.08, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
      style={{ height: '100%' }}
    >
      {content}
    </motion.div>
  ) : (
    content
  );

  return wrapped;
}

function StackHint({ hint }: { hint: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35, mt: 1 }}>
      <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600 }}>
        {hint}
      </Typography>
      <OpenInNewOutlinedIcon sx={{ fontSize: 12, color: 'primary.main' }} />
    </Box>
  );
}
