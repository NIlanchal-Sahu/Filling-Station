import { Box, Paper, Skeleton } from '@mui/material';

export function KpiStatSkeleton() {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="60%" height={16} />
          <Skeleton variant="text" width="45%" height={36} sx={{ mt: 0.5 }} />
        </Box>
        <Skeleton variant="rounded" width={40} height={40} sx={{ borderRadius: 2, flexShrink: 0 }} />
      </Box>
    </Paper>
  );
}
