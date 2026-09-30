import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  alpha,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import { format, isSameDay, parseISO } from 'date-fns';
import { PumpDayPicker } from '@/components/ui/PumpDayPicker';
import { getDailyCashSheetRowForIso } from '@/services/dailyCashSheetLoader';
import type { DailyCashSheetRow } from '@/utils/dailyCashSheet';
import { fmtSheet } from '@/utils/dailyCashSheet';
import { withPumpDayQuery } from '@/utils/dateEntryPolicy';

type Props = {
  pumpDayIso: string;
  maxSelectableIso: string;
};

const EPS = 0.01;

function fmtRupeeSheet(n: number): string {
  return `₹${fmtSheet(n)}`;
}

function payoutLabelSentenceCase(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  const lower = t.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function SnapshotLine(props: { label: string; amount: number; total?: boolean }) {
  const { label, amount, total = false } = props;
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={1}
      sx={{
        py: total ? 0.85 : 0.65,
        px: 0.25,
        minWidth: 0,
        ...(total && {
          mt: 0.5,
          pt: 1,
          borderTop: '1px solid',
          borderColor: 'divider',
        }),
      }}
    >
      <Typography
        variant="body2"
        sx={{
          fontWeight: total ? 800 : 600,
          color: total ? 'text.primary' : 'text.secondary',
          fontSize: { xs: '0.82rem', sm: '0.875rem' },
          flex: 1,
          minWidth: 0,
          pr: 1,
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          fontSize: total ? { xs: '0.9rem', sm: '0.95rem' } : { xs: '0.82rem', sm: '0.875rem' },
          color: total ? 'primary.main' : 'text.primary',
          textAlign: 'right',
          minWidth: 0,
          wordBreak: 'break-word',
        }}
      >
        {fmtRupeeSheet(amount)}
      </Typography>
    </Stack>
  );
}

export function OwnerFinancialSnapshot({ pumpDayIso, maxSelectableIso }: Props) {
  const [snapshotIso, setSnapshotIso] = useState(pumpDayIso);
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<DailyCashSheetRow | null>(null);

  useEffect(() => {
    setSnapshotIso(pumpDayIso);
  }, [pumpDayIso]);

  const snapshotLabel = useMemo(() => {
    const d = parseISO(`${snapshotIso}T12:00:00`);
    return Number.isFinite(d.getTime()) ? format(d, 'dd MMM yyyy') : snapshotIso;
  }, [snapshotIso]);

  const saleLineLabel = useMemo(() => {
    const d = parseISO(`${snapshotIso}T12:00:00`);
    if (!Number.isFinite(d.getTime())) return 'Sale';
    return isSameDay(d, new Date()) ? 'Today sale' : 'Sale';
  }, [snapshotIso]);

  useEffect(() => {
    let ok = true;
    setLoading(true);
    void getDailyCashSheetRowForIso(snapshotIso)
      .then((r) => {
        if (!ok) return;
        setRow(r);
      })
      .catch(() => {
        if (!ok) return;
        setRow(null);
      })
      .finally(() => {
        if (ok) setLoading(false);
      });
    return () => {
      ok = false;
    };
  }, [snapshotIso]);

  const transferLines = useMemo(() => {
    if (!row?.partyPayouts.length) return [];
    return row.partyPayouts
      .filter((p) => p.amount > EPS && p.name.trim())
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [row]);

  const financialDetailsTo = withPumpDayQuery('/manager/daily-sheet', snapshotIso);

  if (loading) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 3.5,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          minHeight: 160,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <CircularProgress size={24} />
      </Paper>
    );
  }

  const totalSales = row?.totalSales ?? 0;
  const phonePe = row?.phonePe ?? 0;
  const iciciBank = row?.iciciBank ?? 0;
  const fleetCard = row?.fleetCard ?? 0;
  const credit = row?.lessCredit ?? 0;
  const shortAmount = row?.shortAmount ?? 0;
  const expenses = row?.expenses ?? 0;
  const cashInHand = row?.closingBalance ?? 0;

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.25 },
        borderRadius: 3.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: (t) =>
          t.palette.mode === 'dark' ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.03)',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: 1.25, minWidth: 0, flexWrap: 'wrap', rowGap: 1 }}
      >
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
          <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 18, color: 'primary.main', flexShrink: 0 }} />
          <Typography
            variant="caption"
            sx={{
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'text.secondary',
              fontSize: '0.68rem',
            }}
          >
            FINANCIAL SNAPSHOT
          </Typography>
        </Stack>
        <PumpDayPicker
          compact
          hideCaption
          label={snapshotLabel}
          dateIso={snapshotIso}
          maxIso={maxSelectableIso}
          onDateIsoChange={setSnapshotIso}
        />
      </Stack>

      <Stack
        spacing={0.15}
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: (t) =>
            t.palette.mode === 'dark' ? alpha(t.palette.common.white, 0.04) : '#f8fafc',
          px: { xs: 1.25, sm: 1.5 },
          py: 1,
        }}
      >
        <SnapshotLine label={saleLineLabel} amount={totalSales} />
        <SnapshotLine label="PhonePe" amount={phonePe} />
        <SnapshotLine label="ICICI Bank" amount={iciciBank} />
        <SnapshotLine label="Fleet Card" amount={fleetCard} />
        <SnapshotLine label="Credit" amount={credit} />
        <SnapshotLine label="Short" amount={shortAmount} />
        {expenses > EPS ? <SnapshotLine label="Expenses" amount={expenses} /> : null}
        {transferLines.map((p) => (
          <SnapshotLine
            key={p.name}
            label={payoutLabelSentenceCase(p.name)}
            amount={p.amount}
          />
        ))}
        <SnapshotLine label="Total cash in hand" amount={cashInHand} total />
      </Stack>

      <Box sx={{ mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button
          component={RouterLink}
          to={financialDetailsTo}
          size="small"
          endIcon={<ArrowForwardOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.82rem',
            p: 0,
            color: 'primary.main',
            '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
          }}
        >
          View Financial Details
        </Button>
      </Box>
    </Paper>
  );
}
