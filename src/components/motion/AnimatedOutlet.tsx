import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const PUBLIC_PATHS = ['/', '/login'];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}

export function AnimatedOutlet() {
  const location = useLocation();
  const reduced = useReducedMotion();
  const publicRoute = isPublicRoute(location.pathname);

  const variants = publicRoute
    ? {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -4 },
      }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      };

  const transition = publicRoute
    ? { duration: reduced ? 0 : 0.35, ease: 'easeOut' as const }
    : { duration: reduced ? 0 : 0.2, ease: 'easeOut' as const };

  if (reduced) {
    return <Outlet />;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={variants.initial}
        animate={variants.animate}
        exit={variants.exit}
        transition={transition}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}
