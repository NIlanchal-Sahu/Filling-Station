import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import { PageHeader } from '@/components/ui/PageHeader';
import { LOCAL_DEMO, EXPLICIT_LOCAL_DEMO } from '@/config/appMode';
import { demoResetStores } from '@/localDemo/demoBackend';

const ENV_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_LOCAL_DEMO',
] as const;

export function AdminSettingsPage() {
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const modeDescription = LOCAL_DEMO
    ? EXPLICIT_LOCAL_DEMO
      ? 'Running in explicit local demo mode (VITE_LOCAL_DEMO=true). Data is stored in this browser.'
      : 'Running in demo mode because Firebase env vars are empty. Data is stored in this browser.'
    : 'Firebase Auth and Firestore are configured for production-style operation.';

  function handleDemoReset() {
    if (!LOCAL_DEMO) {
      return;
    }
    demoResetStores();
    setResetMsg('Demo data reset. Reload the page to see fresh seed data.');
  }

  return (
    <Stack spacing={3} sx={{ pb: 4 }}>
      <PageHeader
        title="System settings"
        subtitle="Environment checklist and demo tools. Secrets are never shown in the UI."
      />

      <Alert severity="info">{modeDescription}</Alert>

      <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Required environment variables
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Set these in <code>.env</code> locally or in Vercel → Project → Settings → Environment Variables.
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
          Firebase deploy (from project README)
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div" sx={{ fontFamily: 'monospace', fontSize: 13 }}>
          npm run firebase:sync-project
          <br />
          npm run firebase:deploy:firestore
          <br />
          npm run firebase:bootstrap
        </Typography>
      </Paper>

      {LOCAL_DEMO ? (
        <Box>
          <Button
            variant="outlined"
            color="warning"
            startIcon={<RestartAltOutlinedIcon />}
            onClick={handleDemoReset}
          >
            Reset demo data
          </Button>
          {resetMsg ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {resetMsg}
            </Typography>
          ) : null}
        </Box>
      ) : null}
    </Stack>
  );
}
