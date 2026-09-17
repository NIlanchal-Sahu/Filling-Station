import type { ComponentProps } from 'react';
import { motion } from 'motion/react';
import { Button } from '@mui/material';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type ButtonProps = ComponentProps<typeof Button>;

type Props = ButtonProps & {
  tapScale?: number;
};

export function MotionButton({ tapScale = 0.98, sx, ...rest }: Props) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <Button sx={sx} {...rest} />;
  }

  return (
    <motion.div whileTap={{ scale: tapScale }} style={{ display: rest.fullWidth ? 'block' : 'inline-block' }}>
      <Button sx={sx} {...rest} />
    </motion.div>
  );
}
