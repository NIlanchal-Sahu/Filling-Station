import { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../lib/api';

export default function JobsScreen() {
  const [jobs, setJobs] = useState<Array<{ id: string; title: string; city: string; jobType: string; employer?: { businessName: string } }>>([]);
  const [search, setSearch] = useState('');

  function loadJobs(q?: string) {
    const query = q ? `?search=${encodeURIComponent(q)}` : '';
    api<{ data: typeof jobs }>(`/jobs${query}`).then((r) => setJobs(r.data)).catch(console.error);
  }

  useEffect(() => { loadJobs(); }, []);

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput style={styles.search} placeholder="Search jobs..." value={search} onChangeText={setSearch} onSubmitEditing={() => loadJobs(search)} />
        <TouchableOpacity style={styles.searchBtn} onPress={() => loadJobs(search)}>
          <Text style={styles.searchBtnText}>Go</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/job/${item.id}`)}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.sub}>{item.employer?.businessName} · {item.city}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F2EF' },
  searchRow: { flexDirection: 'row', padding: 12, gap: 8 },
  search: { flex: 1, backgroundColor: '#fff', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#E0E0E0' },
  searchBtn: { backgroundColor: '#0A66C2', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8 },
  searchBtnText: { color: '#fff', fontWeight: '600' },
  card: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 8, padding: 16, borderRadius: 8 },
  title: { fontWeight: '600', fontSize: 16 },
  sub: { color: '#666', marginTop: 4, fontSize: 13 },
});
