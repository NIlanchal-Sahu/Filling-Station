import { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid2';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Paper, Stack, Typography, alpha } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import { getCashBankCollectionSummary } from '@/services/collectionSummaryService';
import { getOverdueCreditSummary, CREDIT_OVERDUE_DAYS } from '@/services/aggregatesService';
import type { DashboardKpiData } from '@/hooks/useDashboardKpis';
import { KpiStatSkeleton } from '@/components/ui/KpiStatSkeleton';
import { fmtInrCompact } from '@/components/dashboard/manager/dashboardPanelStyles';

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
  loading: boolean;
  data: DashboardKpiData;
};

export function ManagerOverviewKpis({ pumpDayIso, loading, data }: Props) {
  const [collectionTotal, setCollectionTotal] = useState(0);
  const [collectionLoading, setCollectionLoading] = useState(true);
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    let ok = true;
    setCollectionLoading(true);
    void Promise.all([
      getCashBankCollectionSummary(pumpDayIso, pumpDayIso),
      getOverdueCreditSummary(),
    ])
      .then(([coll, credit]) => {
        if (!ok) return;
        setCollectionTotal(coll.totalCollection);
        setOverdueCount(credit.overdueCount);
      })
      .catch(() => {
        if (!ok) return;
        setCollectionTotal(0);
        setOverdueCount(0);
      })
      .finally(() => {
        if (ok) setCollectionLoading(false);
      });
    return () => {
      ok = false;
    };
  }, [pumpDayIso]);

  const busy = loading || collectionLoading;

  if (busy) {
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

  const creditAlert = overdueCount > 0 || data.creditOutstanding > 0.005;

  return (
    <Grid container spacing={1.5} sx={{ width: '100%', minWidth: 0 }}>
      <Grid size={GRID_SIZE} sx={ITEM_SX}>
        <KpiCard
          label="Today's sales"
          value={fmtInrCompact(data.salesTotal)}
          tone="primary"
          icon={TrendingUpOutlinedIcon}
          hint="Meter sales · View details"
          onClick={() => document.getElementById('today-sales')?.scrollIntoView({ behavior: 'smooth' })}
        />
      </Grid>
      <Grid size={GRID_SIZE} sx={ITEM_SX}>
        <KpiCard
          label="Today's collection"
          value={fmtInrCompact(collectionTotal, 2)}
          tone="success"
          icon={AccountBalanceWalletOutlinedIcon}
          hint="All payment modes"
          onClick={() => document.getElementById('collections')?.scrollIntoView({ behavior: 'smooth' })}
        />
      </Grid>
      <Grid size={GRID_SIZE} sx={ITEM_SX}>
        <KpiCard
          label="Cash in hand"
          value={fmtInrCompact(data.cashInHand)}
          tone="info"
          icon={PaymentsOutlinedIcon}
          hint="After reconciliations"
        />
      </Grid>
      <Grid size={GRID_SIZE} sx={ITEM_SX}>
        <KpiCard
          label="Credit outstanding"
          value={fmtInrCompact(data.creditOutstanding, 0)}
          tone="warning"
          icon={CreditCardOutlinedIcon}
          isAlert={creditAlert && overdueCount > 0}
          hint={
            overdueCount > 0
              ? `${overdueCount} overdue · ${CREDIT_OVERDUE_DAYS}+ days`
              : 'View credit ledger'
          }
          to="/manager/credit"
        />
      </Grid>
    </Grid>
  );
}
