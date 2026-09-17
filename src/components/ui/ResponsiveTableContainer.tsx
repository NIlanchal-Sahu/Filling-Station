import type { ReactNode } from 'react';
import { TableContainer, type TableContainerProps } from '@mui/material';

type Props = TableContainerProps & {
  children: ReactNode;
  stickyFirstColumn?: boolean;
};

export function ResponsiveTableContainer({
  children,
  stickyFirstColumn = false,
  sx,
  ...rest
}: Props) {
  return (
    <TableContainer
      {...rest}
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        overflow: 'auto',
        WebkitOverflowScrolling: 'touch',
        ...(stickyFirstColumn
          ? {
              '& tbody td:first-of-type, & thead th:first-of-type': {
                position: 'sticky',
                left: 0,
                zIndex: 1,
                bgcolor: 'background.paper',
                boxShadow: '2px 0 4px -2px rgba(0,0,0,0.18)',
              },
              '& thead th:first-of-type': {
                zIndex: 3,
                bgcolor: 'background.paper',
              },
            }
          : {}),
        ...sx,
      }}
    >
      {children}
    </TableContainer>
  );
}
