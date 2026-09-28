import { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid2';
import { Link as RouterLink } from 'react-router-dom';
import { Paper, Typography } from '@mui/material';
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
const GRID_SIZE = { xs: 6, lg: 3 } as const;
const ITEM_SX = {
  minWidth: 0,
  '@media (max-width:359.95px)': { flexBasis: '100%', maxWidth: '100%' },
} as const;

function KpiCard(props: {
  label: string;
  value: string;
  hint?: string;
  to?: string;
  onClick?: () => void;
}) {
  const { label, value, hint, to, onClick } = props;
  return (
    <Paper
      elevation={0}
      component={to ? RouterLink : onClick ? 'button' : 'div'}
      {...(to ? { to } : {})}
      {...(onClick ? { onClick, type: 'button' as const } : {})}
      sx={{
        p: 1.75,
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        textDecoration: 'none',
        color: 'inherit',
        cursor: to || onClick ? 'pointer' : 'default',
        display: 'block',
        width: '100%',
        minWidth: 0,
        textAlign: 'left',
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 800,
          mt: 0.5,
          fontVariantNumeric: 'tabular-nums',
          fontSize: { xs: '1.05rem', sm: '1.25rem' },
        }}
      >
        {value}
      </Typography>
      {hint ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
          {hint}
        </Typography>
      ) : null}
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
      <Grid size={GRID_SIZE} sx={ITEM_SX}>
        <KpiCard
          label="Today's sales"
          value={fmtInrCompact(sales, 0)}
          to={withPumpDayQuery('/owner/shift-sales', pumpDayIso)}
          hint="Meter sales · view shifts"
        />
      </Grid>
      <Grid size={GRID_SIZE} sx={ITEM_SX}>
        <KpiCard
          label="Today's collection"
          value={fmtInrCompact(collection, 2)}
          to={withPumpDayQuery('/manager/daily-sheet', pumpDayIso)}
          hint="All payment modes"
        />
      </Grid>
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
        />
      </Grid>
      <Grid size={GRID_SIZE} sx={ITEM_SX}>
        <KpiCard label="Cash in hand" value={fmtInrCompact(cashInHand, 0)} hint="After reconciliations" />
      </Grid>
    </Grid>
  );
}
