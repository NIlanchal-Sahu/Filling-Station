import { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid2';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Paper, Stack, Typography, alpha } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import {
  CREDIT_OVERDUE_DAYS,
  getCashInHandAfterReconciliations,
  getOverdueCreditSummary,
  getPumpDaySalesOverview,
} from '@/services/aggregatesService';
import { getCashBankCollectionSummary } from '@/services/collectionSummaryService';
import { KpiStatSkeleton } from '@/components/ui/KpiStatSkeleton';
import { fmtInrCompact } from '@/components/dashboard/owner/ownerPanelStyles';
import { withPumpDayQuery } from '@/utils/dateEntryPolicy';

/** 2×2 on phone; one row of four on desktop (lg+) */
const GRID_SIZE = { xs: 6, sm: 6, lg: 3 } as const;
const ITEM_SX = {
  minWidth: 0,
  '@media (max-width:359.95px)': { flexBasis: '100%', maxWidth: '100%' },
} as const;

type CardTone = 'primary' | 'success' | 'warning' | 'info';

function KpiCard(props: {
  label: string;
  value: string;
  hint?: string;
  icon: SvgIconComponent;
  tone: CardTone;
  isAlert?: boolean;
  to?: string;
  onClick?: () => void;
}) {
  const { label, value, hint, icon: Icon, tone, isAlert = false, to, onClick } = props;
  const isClickable = Boolean(to || onClick);

  return (
    <Paper
      elevation={0}
      component={to ? RouterLink : onClick ? 'button' : 'div'}
      {...(to ? { to } : {})}
      {...(onClick ? { onClick, type: 'button' as const } : {})}
      sx={{
        p: { xs: 1.75, sm: 2 },
        height: '100%',
        minHeight: { xs: 104, sm: 114 },
        border: '1px solid',
        borderColor: isAlert ? (t) => alpha(t.palette.warning.main, 0.45) : 'divider',
        borderRadius: 3.5,
        textDecoration: 'none',
        color: 'inherit',
        cursor: isClickable ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        minWidth: 0,
        textAlign: 'left',
        bgcolor: isAlert
          ? (t) => alpha(t.palette.warning.main, t.palette.mode === 'dark' ? 0.08 : 0.03)
          : 'background.paper',
        boxShadow: (t) =>
          t.palette.mode === 'dark' ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.03)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
        ...(isClickable && {
          '&:hover': {
            transform: 'translateY(-2px)',
            borderColor: (t) => alpha(t.palette[tone].main, 0.5),
            boxShadow: (t) => `0 6px 20px ${alpha(t.palette[tone].main, 0.12)}`,
          },
        }),
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={0.5}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            color: 'text.secondary',
            fontSize: { xs: '0.62rem', sm: '0.7rem' },
            lineHeight: 1.2,
          }}
          noWrap
        >
          {label}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            borderRadius: 1.5,
            flexShrink: 0,
            bgcolor: (t) => alpha(t.palette[tone].main, 0.1),
            color: `${tone}.main`,
          }}
        >
          <Icon sx={{ fontSize: 15 }} />
        </Box>
      </Stack>

      <Box sx={{ mt: 1 }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
            fontSize: { xs: '1.25rem', sm: '1.45rem', md: '1.6rem' },
            color: isAlert ? 'warning.main' : 'text.primary',
            lineHeight: 1.15,
            wordBreak: 'break-word',
          }}
        >
          {value}
        </Typography>
        {hint ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'block',
              mt: 0.4,
              fontSize: { xs: '0.68rem', sm: '0.72rem' },
              lineHeight: 1.25,
            }}
            noWrap
          >
            {hint}
          </Typography>
        ) : null}
      </Box>
    </Paper>
  );
}

type Props = {
  pumpDayIso: string;
};

export function OwnerOverviewKpis({ pumpDayIso }: Props) {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState(0);
  const [collection, setCollection] = useState(0);
  const [overdue, setOverdue] = useState(0);
  const [overdueParties, setOverdueParties] = useState(0);
  const [cashInHand, setCashInHand] = useState(0);

  useEffect(() => {
    let ok = true;
    setLoading(true);
    void Promise.all([
      getPumpDaySalesOverview(pumpDayIso),
      getCashBankCollectionSummary(pumpDayIso, pumpDayIso),
      getOverdueCreditSummary(),
      getCashInHandAfterReconciliations(),
    ])
      .then(([salesOv, coll, credit, cash]) => {
        if (!ok) return;
        setSales(salesOv.meterSalesAmount);
        setCollection(coll.totalCollection);
        setOverdue(credit.overdueAmount);
        setOverdueParties(credit.overdueCount);
        setCashInHand(cash);
      })
      .catch(() => {
        if (!ok) return;
        setSales(0);
        setCollection(0);
        setOverdue(0);
        setOverdueParties(0);
        setCashInHand(0);
      })
      .finally(() => {
        if (ok) setLoading(false);
      });
    return () => {
      ok = false;
    };
  }, [pumpDayIso]);

  if (loading) {
    return (
      <Grid container spacing={1.5} sx={{ width: '100%', minWidth: 0 }}>
        {[0, 1, 2, 3].map((i) => (
          <Grid key={i} size={GRID_SIZE} sx={ITEM_SX}>
            <KpiStatSkeleton />
          </Grid>
        ))}
      </Grid>
    );
  }

  return (
    <Grid container spacing={1.5} sx={{ width: '100%', minWidth: 0 }}>
      {/* 1. Today's Sales: Primary / Neutral */}
      <Grid size={GRID_SIZE} sx={ITEM_SX}>
        <KpiCard
          label="Today's sales"
          value={fmtInrCompact(sales, 0)}
          to={withPumpDayQuery('/owner/shift-sales', pumpDayIso)}
          hint="Meter sales · View shifts →"
          icon={TrendingUpOutlinedIcon}
          tone="primary"
        />
      </Grid>

      {/* 2. Today's Collection: Positive / Neutral */}
      <Grid size={GRID_SIZE} sx={ITEM_SX}>
        <KpiCard
          label="Today's collection"
          value={fmtInrCompact(collection, 2)}
          to={withPumpDayQuery('/manager/daily-sheet', pumpDayIso)}
          hint="All payment modes"
          icon={AccountBalanceWalletOutlinedIcon}
          tone="success"
        />
      </Grid>

      {/* 3. Overdue Credit: Warning / Critical */}
      <Grid size={GRID_SIZE} sx={ITEM_SX}>
        <KpiCard
          label="Overdue credit"
          value={fmtInrCompact(overdue, 0)}
          to="/manager/credit"
          hint={
            overdueParties > 0
              ? `${overdueParties} ${overdueParties === 1 ? 'party' : 'parties'} · ${CREDIT_OVERDUE_DAYS}+ days`
              : `None over ${CREDIT_OVERDUE_DAYS} days`
          }
          icon={CreditCardOutlinedIcon}
          tone="warning"
          isAlert={overdue > 0}
        />
      </Grid>

      {/* 4. Cash in Hand: Neutral / Positive */}
      <Grid size={GRID_SIZE} sx={ITEM_SX}>
        <KpiCard
          label="Cash in hand"
          value={fmtInrCompact(cashInHand, 0)}
          hint="After reconciliations"
          icon={PaymentsOutlinedIcon}
          tone="info"
        />
      </Grid>
    </Grid>
  );
}
