import { alpha, Box } from '@mui/material';
import { motion } from 'motion/react';
import { useThemeMode } from '@/context/ThemeModeContext';
import { marketingMeshBackground, marketingPalette } from '@/theme/marketingTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export function MarketingBackground() {
  const reduced = useReducedMotion();
  const { resolvedMode } = useThemeMode();
  const palette = marketingPalette(resolvedMode);
  const orbsForMode = [
    { size: 280, top: '8%', left: '-8%', color: palette.cyan, duration: 14, x: 24, y: -18 },
    { size: 220, top: '55%', right: '-6%', color: palette.violet, duration: 18, x: -20, y: 22 },
    { size: 180, bottom: '12%', left: '35%', color: palette.blue, duration: 16, x: 16, y: -14 },
  ] as const;

  return (
    <>
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          background: marketingMeshBackground(palette),
        }}
      />
      {!reduced
        ? orbsForMode.map((orb, i) => (
            <Box
              key={i}
              component={motion.div}
              animate={{
                x: [0, orb.x, 0],
                y: [0, orb.y, 0],
                scale: [1, 1.06, 1],
              }}
              transition={{
                duration: orb.duration,
                repeat: Infinity,
                repeatType: 'reverse',
                ease: 'easeInOut',
              }}
              sx={{
                position: 'fixed',
                width: orb.size,
                height: orb.size,
                borderRadius: '50%',
                filter: 'blur(72px)',
                bgcolor: alpha(orb.color, 0.14),
                pointerEvents: 'none',
                zIndex: 0,
                top: 'top' in orb ? orb.top : undefined,
                left: 'left' in orb ? orb.left : undefined,
                right: 'right' in orb ? orb.right : undefined,
                bottom: 'bottom' in orb ? orb.bottom : undefined,
              }}
            />
          ))
        : null}
    </>
  );
}
