import { alpha, Box, Paper, Typography } from '@mui/material';

export function ReadOnlyBanner() {
  return (
    <Box sx={{ mb: 2 }}>
      <Paper
        elevation={0}
        sx={{
          px: 2,
          py: 1.25,
          bgcolor: (t) => alpha(t.palette.info.main, 0.08),
          border: '1px solid',
          borderColor: (t) => alpha(t.palette.info.main, 0.25),
          borderRadius: 1.5,
        }}
      >
        <Typography variant="body2" color="info.main">
          View-only mode — you can review data but cannot make changes.
        </Typography>
      </Paper>
    </Box>
  );
}
