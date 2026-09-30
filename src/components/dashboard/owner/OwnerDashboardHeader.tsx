import { useEffect, useState } from 'react';
import { Box, Chip, IconButton, Stack, Tooltip, Typography, alpha } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { PumpDayPicker } from '@/components/ui/PumpDayPicker';

type Props = {
  reportLabel: string;
  isSelectedToday: boolean;
  reportIso: string;
  maxSelectableIso: string;
  onReportIsoChange: (iso: string) => void;
  lastUpdated?: Date;
  onRefresh?: () => void;
};

function formatLastUpdated(date: Date): string {
  const diffSecs = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSecs < 45) return 'Just now';
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  return `${diffHours}h ago`;
}

export function OwnerDashboardHeader(props: Props) {
  const {
    reportLabel,
    isSelectedToday,
    reportIso,
    maxSelectableIso,
    onReportIsoChange,
    lastUpdated = new Date(),
    onRefresh,
  } = props;

  const [relativeTime, setRelativeTime] = useState(() => formatLastUpdated(lastUpdated));
  const [isRotating, setIsRotating] = useState(false);

  useEffect(() => {
    setRelativeTime(formatLastUpdated(lastUpdated));
    const interval = setInterval(() => {
      setRelativeTime(formatLastUpdated(lastUpdated));
    }, 30000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const handleRefresh = () => {
    setIsRotating(true);
    setTimeout(() => setIsRotating(false), 600);
    if (onRefresh) onRefresh();
  };

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      gap={1.5}
      sx={{ width: '100%', minWidth: 0 }}
    >
      {/* Title & Live / Timestamp */}
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.35rem', sm: '1.5rem' },
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
            }}
          >
            Owner Dashboard
          </Typography>
          {isSelectedToday ? (
            <Chip
              label="Live"
              size="small"
              color="success"
              sx={{
                fontWeight: 700,
                height: 22,
                fontSize: '0.7rem',
                bgcolor: (t) => alpha(t.palette.success.main, 0.12),
                color: 'success.dark',
                border: '1px solid',
                borderColor: (t) => alpha(t.palette.success.main, 0.25),
              }}
            />
          ) : (
            <Chip
              label="Past Date"
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600, height: 22, fontSize: '0.7rem' }}
            />
          )}
        </Stack>

        {/* Priority 14: Last updated */}
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
            Last updated: {relativeTime}
          </Typography>
          {onRefresh ? (
            <Tooltip title="Refresh dashboard data">
              <IconButton
                size="small"
                onClick={handleRefresh}
                sx={{
                  p: 0.25,
                  color: 'text.secondary',
                  transform: isRotating ? 'rotate(360deg)' : 'none',
                  transition: 'transform 0.5s ease',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                <RefreshIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>
      </Box>

      <Box sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>
        <PumpDayPicker
          label={reportLabel}
          dateIso={reportIso}
          maxIso={maxSelectableIso}
          onDateIsoChange={onReportIsoChange}
        />
      </Box>
    </Stack>
  );
}
