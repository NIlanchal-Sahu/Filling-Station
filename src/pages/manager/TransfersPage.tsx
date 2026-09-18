import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { FilterToolbar } from '@/components/ui/FilterToolbar';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReadOnlyBanner } from '@/components/ui/ReadOnlyBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { listLedgerInRange } from '@/services/ledgerService';
import type { LedgerEntry } from '@/types/entities';
import {
  clampEntryDateForRole,
  parsePumpDayParam,
  recalledAdminPumpDay,
  todayIso,
} from '@/utils/dateEntryPolicy';
import { summarizeTransferNames, transferBookLines } from '@/utils/transferBook';
import {
  downloadTransferBookCsv,
  downloadTransferBookPdf,
  type TransferBookExportLine,
} from '@/utils/transferBookExport';

function fmtRs(n: number): string {
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDay(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? iso : format(d, 'dd-MM-yyyy');
}

function fmtSheetDate(d: Date): string {
  return format(d, 'dd-MM-yyyy');
}

function csvAmt(n: number): string {
  return n.toFixed(2);
}

const exportMenuPaperSx = {
  bgcolor: 'background.paper',
  backgroundImage: 'none',
  opacity: 1,
} as const;

const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: 1.5 } };

function BookField({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="baseline">
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: strong ? 700 : 500,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

export function TransfersPage() {
  const { profile } = useAuth();
  const { readOnlyOps } = usePermissions();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  const [searchParams, setSearchParams] = useSearchParams();

  const [from, setFrom] = useState(() => todayIso());
  const [to, setTo] = useState(() => todayIso());
  const [rows, setRows] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [exportEl, setExportEl] = useState<null | HTMLElement>(null);

  const dayParam = searchParams.get('day');
  const selectedKey = (searchParams.get('name') ?? '').trim().toUpperCase().replace(/\s+/g, ' ');

  const names = useMemo(() => summarizeTransferNames(rows), [rows]);
  const selected = names.find((n) => n.key === selectedKey) ?? null;
  const book = useMemo(
    () => (selectedKey ? transferBookLines(rows, selectedKey) : []),
    [rows, selectedKey],
  );

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const a = new Date(from + 'T00:00:00');
      const b = new Date(to + 'T23:59:59.999');
      setRows(await listLedgerInRange(a, b));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when range changes
  }, [from, to]);

  useEffect(() => {
    const day = parsePumpDayParam(dayParam);
    const recalled = profile?.role === 'admin' ? recalledAdminPumpDay() : null;
    const pumpDay = day ?? recalled;
    if (pumpDay) {
      const clamped = clampEntryDateForRole(profile?.role, pumpDay);
      setFrom(clamped);
      setTo(clamped);
    }
  }, [dayParam, profile?.role]);

  function openName(key: string) {
    const next = new URLSearchParams(searchParams);
    next.set('name', key);
    setSearchParams(next, { replace: true });
  }

  function closeName() {
    const next = new URLSearchParams(searchParams);
    next.delete('name');
    setSearchParams(next, { replace: true });
  }

  function exportRows(): { label: string; csv: (string | number)[][]; pdf: TransferBookExportLine[] } {
    const label = selected?.displayName ?? selectedKey;
    const paid = selected?.paid ?? 0;
    const received = selected?.received ?? 0;
    const balance = selected?.running ?? paid - received;
    const csv = [
      ...book.map((line) => [
        fmtSheetDate(line.date.toDate()),
        line.particulars,
        line.type === 'expense' ? csvAmt(line.amount) : '',
        line.type === 'income' ? csvAmt(line.amount) : '',
        csvAmt(line.run),
      ]),
      ['', 'Total', csvAmt(paid), csvAmt(received), csvAmt(balance)],
    ];
    const pdf: TransferBookExportLine[] = [
      ...book.map((line) => ({
        date: fmtSheetDate(line.date.toDate()),
        particular: line.particulars,
        paid: line.type === 'expense' ? fmtRs(line.amount) : '',
        received: line.type === 'income' ? fmtRs(line.amount) : '',
        running: fmtRs(line.run),
      })),
      {
        date: '',
        particular: 'Total',
        paid: fmtRs(paid),
        received: fmtRs(received),
        running: fmtRs(balance),
        bold: true,
      },
    ];
    return { label, csv, pdf };
  }

  function exportMeta() {
    const paid = selected?.paid ?? 0;
    const received = selected?.received ?? 0;
    const balance = selected?.running ?? paid - received;
    return {
      rangeLabel: `${fmtDay(from)} to ${fmtDay(to)}`,
      summaryLabel: `Paid ${fmtRs(paid)} · Received ${fmtRs(received)} · Balance ${fmtRs(balance)}`,
    };
  }

  function exportCsv() {
    const { label, csv } = exportRows();
    const { rangeLabel, summaryLabel } = exportMeta();
    downloadTransferBookCsv({ partyName: label, rangeLabel, summaryLabel, rows: csv });
    setExportEl(null);
  }

  function exportPdf() {
    const { label, pdf } = exportRows();
    const { rangeLabel, summaryLabel } = exportMeta();
    downloadTransferBookPdf(label, rangeLabel, summaryLabel, pdf);
    setExportEl(null);
  }

  if (!profile) {
    return null;
  }

  return (
    <Stack spacing={3} sx={{ pb: 4 }}>
      {readOnlyOps ? <ReadOnlyBanner message="You can review transfer books." /> : null}
      <PageHeader title="Transfers" />

      {err ? <Alert severity="error">{err}</Alert> : null}

      <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
        <FilterToolbar>
          <TextField
            type="date"
            label="From"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
            sx={fieldSx}
          />
          <TextField
            type="date"
            label="To"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
            sx={fieldSx}
          />
        </FilterToolbar>
      </Paper>

      {selectedKey ? (
        <Stack spacing={1.5}>
          <Button
            startIcon={<ArrowBackOutlinedIcon />}
            onClick={closeName}
            sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
          >
            All names
          </Button>
          <Stack
            direction="row"
            spacing={1}
            alignItems="flex-start"
            justifyContent="space-between"
            flexWrap="wrap"
            useFlexGap
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {selected?.displayName ?? selectedKey}
              </Typography>
              {selected ? (
                <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  Paid {fmtRs(selected.paid)} · Received {fmtRs(selected.received)} · Balance {fmtRs(selected.running)}
                </Typography>
              ) : null}
            </Box>
            {book.length > 0 && !loading ? (
              <>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<FileDownloadOutlinedIcon />}
                  endIcon={<ArrowDropDownIcon />}
                  onClick={(e) => setExportEl(e.currentTarget)}
                  sx={{ borderRadius: 1.5, minHeight: 44, flexShrink: 0 }}
                >
                  Export
                </Button>
                <Menu
                  anchorEl={exportEl}
                  open={Boolean(exportEl)}
                  onClose={() => setExportEl(null)}
                  slotProps={{ paper: { elevation: 8, sx: exportMenuPaperSx } }}
                >
                  <MenuItem onClick={exportCsv} sx={{ minHeight: 44 }}>
                    CSV
                  </MenuItem>
                  <MenuItem onClick={exportPdf} sx={{ minHeight: 44 }}>
                    PDF
                  </MenuItem>
                </Menu>
              </>
            ) : null}
          </Stack>
          {loading ? (
            <Typography color="text.secondary">Loading…</Typography>
          ) : book.length === 0 ? (
            <EmptyState title="No lines for this name in this range" />
          ) : compact ? (
            <Stack spacing={1}>
              {book.map((line) => (
                <Paper key={line.id} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                  <Stack spacing={0.5}>
                    <BookField label="Date" value={fmtSheetDate(line.date.toDate())} />
                    <BookField label="Particular" value={line.particulars} />
                    <BookField label="Paid" value={line.type === 'expense' ? fmtRs(line.amount) : ''} />
                    <BookField label="Received" value={line.type === 'income' ? fmtRs(line.amount) : ''} />
                    <BookField label="Running" value={fmtRs(line.run)} strong />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Particular</TableCell>
                    <TableCell align="right">Paid</TableCell>
                    <TableCell align="right">Received</TableCell>
                    <TableCell align="right">Running</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {book.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>{fmtSheetDate(line.date.toDate())}</TableCell>
                      <TableCell>{line.particulars}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {line.type === 'expense' ? fmtRs(line.amount) : ''}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {line.type === 'income' ? fmtRs(line.amount) : ''}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtRs(line.run)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </Stack>
      ) : loading ? (
        <Typography color="text.secondary">Loading…</Typography>
      ) : names.length === 0 ? (
        <EmptyState title="No transfer names in this range" />
      ) : (
        <Stack spacing={1}>
          {names.map((n) => (
            <Card key={n.key} variant="outlined" sx={{ borderRadius: 1.5 }}>
              <CardActionArea onClick={() => openName(n.key)} sx={{ px: 2, py: 1.5 }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {n.displayName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {fmtDay(n.lastDateIso)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtRs(n.running)}
                  </Typography>
                </Stack>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
