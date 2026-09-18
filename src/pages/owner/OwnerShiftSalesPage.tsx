import { useEffect, useMemo, useState } from 'react';
import { Chip, Paper, Stack, TextField } from '@mui/material';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import { format, isSameDay } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReadOnlyBanner } from '@/components/ui/ReadOnlyBanner';
import { TodaySalesByShiftSection } from '@/pages/manager/TodaySalesByShiftSection';
import { parsePumpDayParam } from '@/utils/dateEntryPolicy';

function parseLocalYmd(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function initialPumpDay(searchDay: string | null): string {
  const today = format(new Date(), 'yyyy-MM-dd');
  const fromQuery = parsePumpDayParam(searchDay);
  if (fromQuery && fromQuery <= today) return fromQuery;
  return today;
}

export function OwnerShiftSalesPage() {
  const [searchParams] = useSearchParams();
  const maxSelectableIso = format(new Date(), 'yyyy-MM-dd');
  const [reportIso, setReportIso] = useState(() => initialPumpDay(searchParams.get('day')));

  useEffect(() => {
    setReportIso(initialPumpDay(searchParams.get('day')));
  }, [searchParams]);

  const reportDay = useMemo(() => parseLocalYmd(reportIso), [reportIso]);
  const reportLabel = useMemo(
    () => (Number.isFinite(reportDay.getTime()) ? format(reportDay, 'dd MMM yyyy') : reportIso),
    [reportDay, reportIso],
  );
  const isSelectedToday = Number.isFinite(reportDay.getTime()) && isSameDay(reportDay, new Date());

  return (
    <Stack spacing={3.5} sx={{ pb: 4 }}>
      <ReadOnlyBanner />
      <PageHeader
        title="Shift sales"
        subtitle={`${reportLabel}${isSelectedToday ? ' · Today' : ''}`}
        action={
          isSelectedToday ? (
            <Chip label="Live" size="small" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
          ) : null
        }
      />

      <Paper
        elevation={0}
        sx={{
          p: 1.75,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <CalendarMonthOutlinedIcon sx={{ fontSize: 22, color: 'text.secondary', display: { xs: 'none', sm: 'block' } }} />
          <TextField
            type="date"
            label="Pump day"
            value={reportIso}
            onChange={(e) => {
              const next = e.target.value;
              if (next && next <= maxSelectableIso) setReportIso(next);
            }}
            size="small"
            slotProps={{
              htmlInput: { max: maxSelectableIso },
              inputLabel: { shrink: true },
            }}
            sx={{ minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
          />
        </Stack>
      </Paper>

      <TodaySalesByShiftSection pumpDayIso={reportIso} reportLabel={reportLabel} />
    </Stack>
  );
}
