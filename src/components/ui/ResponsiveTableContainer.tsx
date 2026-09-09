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
        maxWidth: '100%',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        ...(stickyFirstColumn
          ? {
              '& tbody td:first-of-type, & thead th:first-of-type': {
                position: 'sticky',
                left: 0,
                zIndex: 1,
                bgcolor: 'background.paper',
                boxShadow: '2px 0 4px -2px rgba(0,0,0,0.1)',
              },
              '& thead th:first-of-type': {
                zIndex: 2,
                bgcolor: 'action.hover',
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
