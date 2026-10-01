import {
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { PageHeader } from '@/components/ui/PageHeader';
import { LOCAL_DEMO, EXPLICIT_LOCAL_DEMO } from '@/config/appMode';

const ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_LOCAL_DEMO',
] as const;

export function AdminSettingsPage() {
  const modeDescription = LOCAL_DEMO
    ? EXPLICIT_LOCAL_DEMO
      ? 'Running in explicit local demo mode (VITE_LOCAL_DEMO=true). Data is stored in this browser.'
      : 'Running in demo mode because Supabase env vars are empty. Data is stored in this browser.'
    : 'Supabase Auth and Postgres are configured for production-style operation.';
  return (
    <Stack spacing={3} sx={{ pb: 4 }}>
      <PageHeader title="System settings" />

      <Alert severity="info">{modeDescription}</Alert>

      <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Required environment variables
        </Typography>
        <List dense disablePadding>
          {ENV_VARS.map((name) => (
            <ListItem key={name} disableGutters>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <CheckCircleOutlineIcon fontSize="small" color="action" />
              </ListItemIcon>
              <ListItemText primary={<code>{name}</code>} />
            </ListItem>
          ))}
        </List>
      </Paper>

      <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Supabase setup
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div" sx={{ fontFamily: 'monospace', fontSize: 13 }}>
          Run supabase/schema.sql in the Supabase SQL editor
          <br />
          npm run supabase:bootstrap
        </Typography>
      </Paper>
    </Stack>
  );
}
