import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { api } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';

export default function ApplicationsScreen() {
  const token = useAuthStore((s) => s.accessToken);
  const [apps, setApps] = useState<Array<{ id: string; status: string; job: { title: string; city: string } }>>([]);

  useEffect(() => {
    if (!token) return;
    api<typeof apps>('/applications/my', { token }).then(setApps).catch(console.error);
  }, [token]);

  return (
    <View style={styles.container}>
      <FlatList
        data={apps}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.job.title}</Text>
            <Text style={styles.sub}>{item.job.city}</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>{item.status.replace(/_/g, ' ')}</Text></View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No applications yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F2EF', padding: 12 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 8 },
  title: { fontWeight: '600', fontSize: 16 },
  sub: { color: '#666', marginTop: 4 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#E8F4FD', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginTop: 8 },
  badgeText: { fontSize: 12, color: '#0A66C2' },
  empty: { textAlign: 'center', marginTop: 40, color: '#666' },
});
