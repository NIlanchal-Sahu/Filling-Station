import { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid2';
import { Link as RouterLink } from 'react-router-dom';
import { Paper, Typography } from '@mui/material';
import { getCashBankCollectionSummary } from '@/services/collectionSummaryService';
import type { DashboardKpiData } from '@/hooks/useDashboardKpis';
import { KpiStatSkeleton } from '@/components/ui/KpiStatSkeleton';
import { fmtInrCompact } from '@/components/dashboard/manager/dashboardPanelStyles';

const GRID_SIZE = { xs: 6, sm: 3 } as const;
const ITEM_SX = {
  minWidth: 0,
  '@media (max-width:359.95px)': { flexBasis: '100%', maxWidth: '100%' },
} as const;

type Props = {
  pumpDayIso: string;
  loading: boolean;
  data: DashboardKpiData;
};

function OverviewKpiCard(props: {
  label: string;
  value: string;
  to?: string;
  onClick?: () => void;
}) {
  const { label, value, to, onClick } = props;
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
        textAlign: 'left',
        width: '100%',
        minWidth: 0,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
        {label}
      </Typography>
      <Typography
        variant="h6"
        sx={{
          fontWeight: 800,
          mt: 0.5,
          fontVariantNumeric: 'tabular-nums',
          fontSize: { xs: '1.05rem', sm: '1.2rem' },
          lineHeight: 1.2,
        }}
      >
        {value}
      </Typography>
    </Paper>
  );
}

export function ManagerOverviewKpis({ pumpDayIso, loading, data }: Props) {
  const [collectionTotal, setCollectionTotal] = useState(0);
  const [collectionLoading, setCollectionLoading] = useState(true);

  useEffect(() => {
    let ok = true;
    setCollectionLoading(true);
    void getCashBankCollectionSummary(pumpDayIso, pumpDayIso)
      .then((s) => {
        if (ok) setCollectionTotal(s.totalCollection);
      })
      .catch(() => {
        if (ok) setCollectionTotal(0);
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

  return (
    <Grid container spacing={1.5} sx={{ width: '100%', minWidth: 0 }}>
      <Grid size={GRID_SIZE} sx={ITEM_SX}>
        <OverviewKpiCard
          label="Today's sales"
          value={fmtInrCompact(data.salesTotal)}
          onClick={() => document.getElementById('today-sales')?.scrollIntoView({ behavior: 'smooth' })}
        />
      </Grid>
      <Grid size={GRID_SIZE} sx={ITEM_SX}>
        <OverviewKpiCard
          label="Today's collection"
          value={fmtInrCompact(collectionTotal, 2)}
          onClick={() => document.getElementById('collections')?.scrollIntoView({ behavior: 'smooth' })}
        />
      </Grid>
      <Grid size={GRID_SIZE} sx={ITEM_SX}>
        <OverviewKpiCard label="Cash in hand" value={fmtInrCompact(data.cashInHand)} />
      </Grid>
      <Grid size={GRID_SIZE} sx={ITEM_SX}>
        <OverviewKpiCard
          label="Credit outstanding"
          value={fmtInrCompact(data.creditOutstanding, 2)}
          to="/manager/credit"
        />
      </Grid>
    </Grid>
  );
}
