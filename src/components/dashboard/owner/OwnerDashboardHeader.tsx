import { Box, Chip, Stack, TextField, Typography } from '@mui/material';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';

type Props = {
  reportLabel: string;
  isSelectedToday: boolean;
  reportIso: string;
  maxSelectableIso: string;
  onReportIsoChange: (iso: string) => void;
};

export function OwnerDashboardHeader(props: Props) {
  const { reportLabel, isSelectedToday, reportIso, maxSelectableIso, onReportIsoChange } = props;

  return (
    <Stack spacing={1.5} sx={{ width: '100%', minWidth: 0 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1} flexWrap="wrap">
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.25, fontSize: { xs: '1.35rem', sm: '1.5rem' } }}>
            Owner dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Business performance · {reportLabel}
            {isSelectedToday ? ' · Today' : ''}
          </Typography>
        </Box>
        {isSelectedToday ? (
          <Chip label="Live" size="small" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
        ) : null}
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
        <CalendarMonthOutlinedIcon sx={{ fontSize: 20, color: 'text.secondary', display: { xs: 'none', sm: 'block' } }} />
        <TextField
          type="date"
          label="Pump day"
          value={reportIso}
          onChange={(e) => onReportIsoChange(e.target.value)}
          size="small"
          slotProps={{
            htmlInput: { max: maxSelectableIso },
            inputLabel: { shrink: true },
          }}
          sx={{
            width: '100%',
            maxWidth: { sm: 220 },
            '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
          }}
        />
      </Stack>
    </Stack>
  );
}
