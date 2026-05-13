import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';

type Props = { children: ReactNode };

type State = { hasError: boolean; message: string | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, message: error.message };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error boundary:', error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 3, maxWidth: 520, mx: 'auto', mt: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Something went wrong
            </Typography>
            <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
              {this.state.message}
            </Typography>
          </Alert>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
