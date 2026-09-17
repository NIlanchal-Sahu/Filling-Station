import type { ComponentProps } from 'react';
import { motion } from 'motion/react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type MotionDivProps = ComponentProps<typeof motion.div>;

export type MotionPreset = 'fade' | 'fadeUp' | 'fadeDown' | 'fadeInRight' | 'scaleIn';

const presets: Record<
  MotionPreset,
  { initial: MotionDivProps['initial']; animate: MotionDivProps['animate']; transition: MotionDivProps['transition'] }
> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.3 },
  },
  fadeUp: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35 },
  },
  fadeDown: {
    initial: { opacity: 0, y: -8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 },
  },
  fadeInRight: {
    initial: { opacity: 0, x: 16 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.4 },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.45 },
  },
};

type Props = MotionDivProps & {
  preset?: MotionPreset;
  disableMotion?: boolean;
};

export function MotionBox({ preset = 'fade', disableMotion, initial, animate, transition, ...rest }: Props) {
  const reduced = useReducedMotion();
  const skip = disableMotion ?? reduced;
  const p = presets[preset];

  if (skip) {
    return <motion.div {...rest} />;
  }

  return (
    <motion.div
      initial={initial ?? p.initial}
      animate={animate ?? p.animate}
      transition={transition ?? p.transition}
      {...rest}
    />
  );
}
