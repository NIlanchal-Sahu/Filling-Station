import { alpha, Box, Chip, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import { format, parseISO } from 'date-fns';
import { ResponsiveTableContainer } from '@/components/ui/ResponsiveTableContainer';
import type { DipValueRegisterRow } from '@/utils/dipValueRegister';

const headSx = {
  fontWeight: 700,
  fontSize: '0.68rem',
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  bgcolor: 'background.paper',
  color: 'text.primary',
  border: '1px solid',
  borderColor: 'divider',
  whiteSpace: 'nowrap' as const,
};

const cellSx = {
  border: '1px solid',
  borderColor: 'divider',
  fontVariantNumeric: 'tabular-nums' as const,
};

function fmtLiters(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

function fmtRegisterDate(pumpDayIso: string): string {
  try {
    return format(parseISO(`${pumpDayIso}T12:00:00`), 'dd-MMM-yyyy');
  } catch {
    return pumpDayIso;
  }
}

type Props = {
  title: string;
  rows: DipValueRegisterRow[];
  emptyMessage?: string;
  showTitle?: boolean;
  highlightDayIso?: string;
  accentColor?: string;
};

function VariationCell({ value }: { value: number | null | undefined }) {
  if (value == null) {
    return (
      <Typography variant="body2" color="text.disabled" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        —
      </Typography>
    );
  }
  const color = value === 0 ? 'default' : value > 0 ? 'success' : 'warning';
  const label = `${value > 0 ? '+' : ''}${fmtLiters(value)}`;
  return <Chip size="small" label={label} color={color} variant="outlined" sx={{ fontWeight: 600, minWidth: 56 }} />;
}

export function DipValueRegisterTable({
  title,
  rows,
  emptyMessage,
  showTitle = true,
  highlightDayIso,
  accentColor,
}: Props) {
  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        borderColor: accentColor ? alpha(accentColor, 0.35) : 'divider',
        boxShadow: accentColor ? `inset 3px 0 0 ${accentColor}` : undefined,
      }}
    >
      {showTitle ? (
        <Typography variant="subtitle2" sx={{ fontWeight: 700, px: 2, pt: 1.5, pb: 1 }}>
          {title}
        </Typography>
      ) : null}
      {rows.length === 0 && emptyMessage ? (
        <Stack alignItems="center" spacing={1} sx={{ px: 2, py: 4, textAlign: 'center' }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'action.hover',
              color: 'text.secondary',
            }}
          >
            <TableChartOutlinedIcon />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280 }}>
            {emptyMessage}
          </Typography>
        </Stack>
      ) : (
        <ResponsiveTableContainer>
          <Table
            size="small"
            sx={{
              minWidth: 720,
              borderCollapse: 'collapse',
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={headSx}>Date</TableCell>
                <TableCell sx={headSx} align="right">
                  Opening (L)
                </TableCell>
                <TableCell sx={headSx} align="right">
                  Receipt (L)
                </TableCell>
                <TableCell sx={headSx} align="right">
                  Total (L)
                </TableCell>
                <TableCell sx={headSx} align="right">
                  Sales (L)
                </TableCell>
                <TableCell sx={headSx} align="right">
                  Closing book (L)
                </TableCell>
                <TableCell sx={headSx} align="right">
                  Variation (L)
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => {
                const highlighted = highlightDayIso != null && r.pumpDayIso === highlightDayIso;
                return (
                <TableRow
                  key={r.pumpDayIso}
                  hover
                  sx={{
                    ...(highlighted
                      ? {
                          bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                          '& td': { borderColor: (t) => alpha(t.palette.primary.main, 0.2) },
                        }
                      : {}),
                  }}
                >
                  <TableCell sx={cellSx}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>{fmtRegisterDate(r.pumpDayIso)}</span>
                      {highlighted ? (
                        <Chip label="Pump day" size="small" color="primary" variant="outlined" sx={{ height: 22 }} />
                      ) : null}
                    </Stack>
                  </TableCell>
                  <TableCell align="right" sx={cellSx}>
                    {fmtLiters(r.openingStockLiters)}
                  </TableCell>
                  <TableCell align="right" sx={cellSx}>
                    {fmtLiters(r.receiptLiters)}
                  </TableCell>
                  <TableCell align="right" sx={cellSx}>
                    {fmtLiters(r.totalStockLiters)}
                  </TableCell>
                  <TableCell align="right" sx={cellSx}>
                    {fmtLiters(r.salesLiters)}
                  </TableCell>
                  <TableCell align="right" sx={{ ...cellSx, fontWeight: 600 }}>
                    {fmtLiters(r.closingBookLiters)}
                  </TableCell>
                  <TableCell align="right" sx={cellSx}>
                    <VariationCell value={r.variationLiters} />
                  </TableCell>
                </TableRow>
              );
              })}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
      )}
    </Paper>
  );
}
