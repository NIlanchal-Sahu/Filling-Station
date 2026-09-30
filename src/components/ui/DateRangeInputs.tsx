import { useState } from 'react';
import {
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
  type TextFieldProps,
} from '@mui/material';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import {
  applyDateRangePreset,
  formatRangeCaption,
  syncDateRange,
  type DateRangePresetId,
} from '@/utils/reportDatePresets';

type Props = {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  fromLabel?: string;
  toLabel?: string;
  required?: boolean;
  error?: boolean;
  fieldSx?: TextFieldProps['sx'];
  /** When true, render only From + To fields (for FilterToolbar row with Submit). */
  embedInToolbar?: boolean;
  showCaption?: boolean;
};

const PRESET_ITEMS: { id: DateRangePresetId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This week' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
];

export function DateRangeInputs({
  from,
  to,
  onChange,
  fromLabel = 'From',
  toLabel = 'To',
  required,
  error,
  fieldSx,
  embedInToolbar = false,
  showCaption = true,
}: Props) {
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  const caption = showCaption ? formatRangeCaption(from, to) : null;

  function pickPreset(id: DateRangePresetId) {
    onChange(applyDateRangePreset(id));
    setMenuEl(null);
  }

  const fromField = (
    <TextField
      type="date"
      label={fromLabel}
      value={from}
      onChange={(e) => {
        onChange(syncDateRange(e.target.value, to, 'from'));
      }}
      size="small"
      required={required}
      error={error}
      slotProps={{
        inputLabel: { shrink: true },
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                size="small"
                aria-label="Quick date range"
                edge="end"
                onClick={(ev) => setMenuEl(ev.currentTarget)}
              >
                <CalendarMonthOutlinedIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
      sx={fieldSx}
    />
  );

  const toField = (
    <TextField
      type="date"
      label={toLabel}
      value={to}
      onChange={(e) => {
        onChange(syncDateRange(from, e.target.value, 'to'));
      }}
      size="small"
      required={required}
      error={error}
      slotProps={{ inputLabel: { shrink: true } }}
      sx={fieldSx}
    />
  );

  const menu = (
    <Menu
      anchorEl={menuEl}
      open={Boolean(menuEl)}
      onClose={() => setMenuEl(null)}
      slotProps={{
        paper: {
          sx: { bgcolor: 'background.paper', backgroundImage: 'none' },
        },
      }}
    >
      {PRESET_ITEMS.map((p) => (
        <MenuItem key={p.id} onClick={() => pickPreset(p.id)}>
          {p.label}
        </MenuItem>
      ))}
    </Menu>
  );

  if (embedInToolbar) {
    return (
      <>
        {fromField}
        {toField}
        {menu}
      </>
    );
  }

  return (
    <Stack spacing={0.75} sx={{ width: '100%' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} useFlexGap flexWrap="wrap">
        {fromField}
        {toField}
      </Stack>
      {caption ? (
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {caption}
        </Typography>
      ) : null}
      {menu}
    </Stack>
  );
}

/** Caption line for use under a toolbar row. */
export function DateRangeCaption({ from, to }: { from: string; to: string }) {
  const caption = formatRangeCaption(from, to);
  if (!caption) return null;
  return (
    <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums', mt: 0.75 }}>
      {caption}
    </Typography>
  );
}
