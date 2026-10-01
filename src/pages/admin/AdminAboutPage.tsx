import { CircularProgress, Stack } from '@mui/material';
import { PageHeader } from '@/components/ui/PageHeader';
import { StationAboutEditor } from '@/components/admin/StationAboutEditor';
import { useAuth } from '@/context/AuthContext';
import { useStationAbout } from '@/context/StationAboutContext';

export function AdminAboutPage() {
  const { profile, loading } = useStationAbout();
  const { firebaseUser, profile: userProfile } = useAuth();
  const updatedBy = firebaseUser?.uid ?? userProfile?.email ?? 'admin';

  return (
    <Stack spacing={3} sx={{ pb: 4 }}>
      <PageHeader
        title="About station"
        subtitle="Customize how your filling station appears in the app — name, address, contact, and hours."
      />
      {loading ? (
        <CircularProgress size={28} />
      ) : (
        <StationAboutEditor initial={profile} updatedBy={updatedBy} />
      )}
    </Stack>
  );
}
