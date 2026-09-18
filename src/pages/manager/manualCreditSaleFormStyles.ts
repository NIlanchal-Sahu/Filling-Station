export const creditSheetHeaderCellSx = {
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  fontSize: '0.72rem',
  letterSpacing: '0.06em',
  bgcolor: 'action.hover',
  border: '1px solid',
  borderColor: 'divider',
  whiteSpace: 'nowrap' as const,
  color: 'text.secondary',
};

export const creditSheetBodyCellSx = {
  border: '1px solid',
  borderColor: 'divider',
  verticalAlign: 'middle' as const,
};

export const creditSheetTableSx = {
  width: '100%',
  tableLayout: 'fixed' as const,
  borderCollapse: 'collapse' as const,
};

export const creditSheetWrapSx = {
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  overflow: 'hidden',
  borderRadius: 1.5,
};
