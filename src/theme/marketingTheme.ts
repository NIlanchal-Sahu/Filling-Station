import { alpha, type SxProps, type Theme } from '@mui/material/styles';

export const MARKETING = {
  bg: '#050816',
  bgElevated: '#0c1229',
  text: '#e8edf7',
  textMuted: '#94a3b8',
  cyan: '#22d3ee',
  blue: '#0ea5e9',
  violet: '#a78bfa',
  border: alpha('#ffffff', 0.1),
  glass: alpha('#ffffff', 0.04),
  glassStrong: alpha('#ffffff', 0.07),
} as const;

export const marketingFontBody = '"Outfit", "Roboto", system-ui, sans-serif';
export const marketingFontDisplay = '"Rajdhani", "Outfit", system-ui, sans-serif';

export function marketingPageSx() {
  return {
    minHeight: '100dvh',
    bgcolor: MARKETING.bg,
    color: MARKETING.text,
    fontFamily: marketingFontBody,
    overflowX: 'clip' as const,
  };
}

export const marketingDarkFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    bgcolor: alpha('#ffffff', 0.04),
    color: MARKETING.text,
    '& fieldset': { borderColor: MARKETING.border },
    '&:hover fieldset': { borderColor: alpha(MARKETING.cyan, 0.45) },
    '&.Mui-focused fieldset': { borderColor: MARKETING.cyan },
  },
  '& .MuiInputLabel-root': { color: MARKETING.textMuted },
  '& .MuiInputLabel-root.Mui-focused': { color: MARKETING.cyan },
} as const;

export type MarketingPalette = {
  bg: string;
  bgElevated: string;
  text: string;
  textMuted: string;
  cyan: string;
  blue: string;
  violet: string;
  border: string;
  glass: string;
  glassStrong: string;
};

export function marketingPalette(mode: 'light' | 'dark'): MarketingPalette {
  if (mode === 'dark') {
    return { ...MARKETING };
  }
  return {
    bg: '#eef2f7',
    bgElevated: '#ffffff',
    text: '#0f172a',
    textMuted: '#64748b',
    cyan: '#0284c7',
    blue: '#0d47a1',
    violet: '#7c3aed',
    border: alpha('#0f172a', 0.12),
    glass: alpha('#ffffff', 0.72),
    glassStrong: alpha('#ffffff', 0.92),
  };
}

export function marketingMeshBackground(palette: MarketingPalette) {
  return `
    radial-gradient(ellipse 80% 50% at 15% -10%, ${alpha(palette.cyan, 0.18)} 0%, transparent 55%),
    radial-gradient(ellipse 60% 40% at 90% 10%, ${alpha(palette.violet, 0.12)} 0%, transparent 50%),
    radial-gradient(ellipse 70% 50% at 50% 100%, ${alpha(palette.blue, 0.1)} 0%, transparent 55%)
  `;
}

export function marketingFieldSx(palette: MarketingPalette, mode: 'light' | 'dark'): SxProps<Theme> {
  if (mode === 'light') {
    return {
      '& .MuiOutlinedInput-root': { borderRadius: 2 },
    };
  }
  return {
    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
      bgcolor: alpha('#ffffff', 0.04),
      color: palette.text,
      '& fieldset': { borderColor: palette.border },
      '&:hover fieldset': { borderColor: alpha(palette.cyan, 0.45) },
      '&.Mui-focused fieldset': { borderColor: palette.cyan },
    },
    '& .MuiInputLabel-root': { color: palette.textMuted },
    '& .MuiInputLabel-root.Mui-focused': { color: palette.cyan },
  };
}
