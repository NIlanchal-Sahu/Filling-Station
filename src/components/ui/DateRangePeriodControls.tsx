import type { ReactNode } from 'react';
import {
  alpha,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import {
  formatDateRangeLabel,
  type DatePreset,
} from '@/utils/dateRangePeriodPresets';

type Props = {
  from: string;
  to: string;
  preset: DatePreset;
  onPresetChange: (preset: DatePreset) => void;
  onFromChange: (from: string) => void;
  onToChange: (to: string) => void;
  loading?: boolean;
  onSubmit: () => void;
  submitLabel: string;
  submitLoadingLabel?: string;
  submitIcon?: SvgIconComponent;
  children?: ReactNode;
};

export function DateRangePeriodControls({
  from,
  to,
  preset,
  onPresetChange,
  onFromChange,
  onToChange,
  loading = false,
  onSubmit,
  submitLabel,
  submitLoadingLabel,
  submitIcon: SubmitIcon,
  children,
}: Props) {
  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        spacing={1.5}
      >
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'text.secondary',
              fontSize: '0.7rem',
              mr: 0.5,
            }}
          >
            Period
          </Typography>
          <ToggleButtonGroup
            value={preset}
            exclusive
            onChange={(_, p) => {
              if (p) onPresetChange(p as DatePreset);
            }}
            size="small"
            sx={{
              flexWrap: 'wrap',
              gap: 0.75,
              '& .MuiToggleButtonGroup-grouped': {
                border: '1px solid !important',
                borderColor: 'divider !important',
                borderRadius: '8px !important',
                px: { xs: 1.25, sm: 1.5 },
                py: 0.5,
                fontSize: '0.78rem',
                fontWeight: 600,
                textTransform: 'none',
                color: 'text.primary',
                '&.Mui-selected': {
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                  color: 'primary.main',
                  borderColor: 'primary.main !important',
                  fontWeight: 700,
                },
              },
            }}
          >
            <ToggleButton value="today">Today</ToggleButton>
            <ToggleButton value="yesterday">Yesterday</ToggleButton>
            <ToggleButton value="this_week">This Week</ToggleButton>
            <ToggleButton value="this_month">This Month</ToggleButton>
            <ToggleButton value="custom">Custom</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              bgcolor: (t) => alpha(t.palette.grey[500], 0.08),
              px: 1.25,
              py: 0.5,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CalendarTodayOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>
              {formatDateRangeLabel(from, to)}
            </Typography>
          </Box>
        </Stack>
      </Stack>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'stretch', md: 'center' }}
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        {preset === 'custom' ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ flex: 1 }}>
            <TextField
              type="date"
              label="From"
              value={from}
              onChange={(e) => onFromChange(e.target.value)}
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
            <TextField
              type="date"
              label="To"
              value={to}
              onChange={(e) => onToChange(e.target.value)}
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
            />
          </Stack>
        ) : null}

        {children}

        <Box sx={{ ml: { md: 'auto' }, pt: { xs: 0.5, md: 0 } }}>
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading}
            startIcon={
              loading ? (
                <CircularProgress size={16} color="inherit" />
              ) : SubmitIcon ? (
                <SubmitIcon />
              ) : undefined
            }
            sx={{
              minWidth: { xs: '100%', sm: 180 },
              height: 42,
              borderRadius: 1.5,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: (t) => `0 4px 12px ${alpha(t.palette.primary.main, 0.25)}`,
            }}
          >
            {loading ? (submitLoadingLabel ?? `${submitLabel}…`) : submitLabel}
          </Button>
        </Box>
      </Stack>
    </Stack>
  );
}
