import type { ReactNode } from 'react';
import { Stack, type StackProps } from '@mui/material';

type Props = StackProps & {
  children: ReactNode;
};

export function FilterToolbar({ children, sx, ...rest }: Props) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      flexWrap="wrap"
      useFlexGap
      sx={sx}
      {...rest}
    >
      {children}
    </Stack>
  );
}
