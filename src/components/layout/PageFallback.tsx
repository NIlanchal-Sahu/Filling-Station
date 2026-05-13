import { Box, CircularProgress, Typography } from '@mui/material';

export function PageFallback() {
  return (
    <Box
      component="div"
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', gap: 2 }}
    >
      <CircularProgress size={28} />
      <Typography variant="body2" color="text.secondary">
        Loading…
      </Typography>
    </Box>
  );
}
