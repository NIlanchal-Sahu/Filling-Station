import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useAuthStore } from '../lib/auth-store';

export default function RootLayout() {
  const loadAuth = useAuthStore((s) => s.loadAuth);

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: '#0A66C2' }, headerTintColor: '#fff' }}>
        <Stack.Screen name="index" options={{ title: 'LocalJob' }} />
        <Stack.Screen name="(auth)/login" options={{ title: 'Login' }} />
        <Stack.Screen name="(auth)/signup" options={{ title: 'Sign Up' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="job/[id]" options={{ title: 'Job Details' }} />
      </Stack>
    </>
  );
}
