import { useRef } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';

type Props = {
  label: string;
  dateIso: string;
  maxIso: string;
  minIso?: string;
  onDateIsoChange: (iso: string) => void;
  /** Upper caption above the date label. Default: Pump day */
  caption?: string;
  /** Smaller padding and typography for nested panels */
  compact?: boolean;
  /** Hide the upper caption (e.g. snapshot shows only the date) */
  hideCaption?: boolean;
};

function openNativeDatePicker(input: HTMLInputElement) {
  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker();
      return;
    } catch {
      /* fall through */
    }
  }
  input.focus({ preventScroll: true });
  input.click();
}

export function PumpDayPicker({
  label,
  dateIso,
  maxIso,
  minIso,
  onDateIsoChange,
  caption = 'Pump day',
  compact = false,
  hideCaption = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const triggerPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    openNativeDatePicker(input);
  };

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label="Select pump day"
      onClick={triggerPicker}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          triggerPicker();
        }
      }}
      sx={{
        flexShrink: 0,
        width: 'fit-content',
        maxWidth: '100%',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        px: compact ? 1 : 1.25,
        py: compact ? 0.45 : 0.625,
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        cursor: 'pointer',
        position: 'relative',
        userSelect: 'none',
        boxShadow: (t) =>
          t.palette.mode === 'dark' ? '0 1px 4px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.04)',
        transition:
          'border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease, transform 0.12s ease',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
          boxShadow: (t) => `0 3px 12px ${alpha(t.palette.primary.main, 0.22)}`,
          '& .PumpDayPicker-icon': {
            color: 'primary.dark',
            transform: 'scale(1.08)',
          },
        },
        '&:active': {
          transform: 'scale(0.98)',
        },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
          borderColor: 'primary.main',
        },
      }}
    >
      <Box sx={{ minWidth: 0, pointerEvents: 'none' }}>
        {!hideCaption ? (
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.62rem',
              fontWeight: 800,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              display: 'block',
              lineHeight: 1,
            }}
          >
            {caption}
          </Typography>
        ) : null}
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            fontSize: compact
              ? { xs: '0.78rem', sm: '0.82rem' }
              : { xs: '0.85rem', sm: '0.9rem' },
            lineHeight: 1.25,
            mt: 0.25,
            color: 'text.primary',
          }}
        >
          {label}
        </Typography>
      </Box>
      <CalendarMonthOutlinedIcon
        className="PumpDayPicker-icon"
        sx={{
          fontSize: compact ? 17 : 20,
          color: 'primary.main',
          ml: 0.25,
          flexShrink: 0,
          pointerEvents: 'none',
          transition: 'color 0.2s ease, transform 0.2s ease',
        }}
      />
      <input
        ref={inputRef}
        type="date"
        aria-hidden
        tabIndex={-1}
        max={maxIso}
        min={minIso}
        value={dateIso}
        onChange={(e) => {
          const next = e.target.value;
          if (!next) return;
          if (minIso && next < minIso) return;
          if (next > maxIso) return;
          onDateIsoChange(next);
        }}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
          clip: 'rect(0,0,0,0)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      />
    </Box>
  );
}
