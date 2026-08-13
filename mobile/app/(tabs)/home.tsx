import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';

interface Job {
  id: string;
  title: string;
  city: string;
  jobType: string;
  employer?: { businessName: string };
}

export default function HomeScreen() {
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [recommendations, setRecommendations] = useState<Array<{ job: Job; matchScore: number }>>([]);

  useEffect(() => {
    api<{ data: Job[] }>('/jobs?limit=10').then((r) => setJobs(r.data)).catch(console.error);
    if (token && user?.role === 'STUDENT') {
      api<typeof recommendations>('/matching/student/recommendations', { token }).then(setRecommendations).catch(console.error);
    }
  }, [token, user]);

  const displayJobs = recommendations.length ? recommendations.map((r) => ({ ...r.job, matchScore: r.matchScore })) : jobs;

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Hello, {user?.role === 'EMPLOYER' ? 'Employer' : 'there'} 👋</Text>
      <Text style={styles.section}>{recommendations.length ? 'Recommended Jobs' : 'Latest Jobs'}</Text>
      <FlatList
        data={displayJobs as Array<Job & { matchScore?: number }>}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/job/${item.id}`)}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.company}>{item.employer?.businessName}</Text>
            <View style={styles.row}>
              <Text style={styles.meta}>{item.city}</Text>
              {'matchScore' in item && item.matchScore && (
                <Text style={styles.match}>{item.matchScore}% match</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Start the API to see jobs</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F2EF', padding: 16 },
  greeting: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  section: { fontSize: 16, color: '#666', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E0E0E0' },
  title: { fontSize: 16, fontWeight: '600' },
  company: { color: '#666', marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  meta: { fontSize: 12, color: '#888' },
  match: { fontSize: 12, color: '#057642', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#666', marginTop: 40 },
});
