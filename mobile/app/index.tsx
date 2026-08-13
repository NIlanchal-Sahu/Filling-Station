import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '../lib/auth-store';

export default function Index() {
  const user = useAuthStore((s) => s.user);

  if (user) {
    router.replace('/(tabs)/home');
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>LocalJob</Text>
      <Text style={styles.tagline}>Find local jobs near you</Text>
      <Text style={styles.sub}>Part-time · Internships · Freshers</Text>

      <Link href="/(auth)/login" asChild>
        <TouchableOpacity style={styles.primaryBtn}>
          <Text style={styles.primaryText}>Login</Text>
        </TouchableOpacity>
      </Link>
      <Link href="/(auth)/signup" asChild>
        <TouchableOpacity style={styles.outlineBtn}>
          <Text style={styles.outlineText}>Create Account</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F3F2EF' },
  logo: { fontSize: 36, fontWeight: '700', color: '#0A66C2' },
  tagline: { fontSize: 18, marginTop: 8, color: '#191919' },
  sub: { fontSize: 14, color: '#666', marginTop: 4, marginBottom: 40 },
  primaryBtn: { backgroundColor: '#0A66C2', paddingVertical: 14, paddingHorizontal: 48, borderRadius: 8, width: '100%', marginBottom: 12 },
  primaryText: { color: '#fff', textAlign: 'center', fontWeight: '600', fontSize: 16 },
  outlineBtn: { borderWidth: 1, borderColor: '#0A66C2', paddingVertical: 14, paddingHorizontal: 48, borderRadius: 8, width: '100%' },
  outlineText: { color: '#0A66C2', textAlign: 'center', fontWeight: '600', fontSize: 16 },
});
