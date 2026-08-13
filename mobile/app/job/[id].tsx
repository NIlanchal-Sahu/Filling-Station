import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = useAuthStore((s) => s.accessToken);
  const [job, setJob] = useState<{
    id: string;
    title: string;
    description: string;
    city: string;
    jobType: string;
    salaryMin?: number;
    salaryMax?: number;
    requiredSkills: string[];
    employer: { businessName: string; isVerified: boolean };
  } | null>(null);

  useEffect(() => {
    if (id) api<typeof job>(`/jobs/${id}`).then(setJob).catch(console.error);
  }, [id]);

  async function apply() {
    if (!token) {
      Alert.alert('Login required', 'Please login to apply');
      router.push('/(auth)/login');
      return;
    }
    try {
      await api('/applications', { method: 'POST', token, body: JSON.stringify({ jobId: id }) });
      Alert.alert('Success', 'Application submitted!');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to apply');
    }
  }

  async function saveJob() {
    if (!token) return;
    await api(`/saved-jobs/${id}`, { method: 'POST', token });
    Alert.alert('Saved', 'Job saved to your list');
  }

  if (!job) return <View style={styles.container}><Text>Loading...</Text></View>;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{job.title}</Text>
      <Text style={styles.company}>{job.employer.businessName} {job.employer.isVerified ? '✓' : ''}</Text>
      <Text style={styles.meta}>{job.city} · {job.jobType.replace(/_/g, ' ')}</Text>
      {job.salaryMin && <Text style={styles.salary}>₹{job.salaryMin.toLocaleString()} - ₹{job.salaryMax?.toLocaleString()}/mo</Text>}

      <Text style={styles.section}>Description</Text>
      <Text style={styles.desc}>{job.description}</Text>

      {job.requiredSkills?.length > 0 && (
        <>
          <Text style={styles.section}>Skills</Text>
          <View style={styles.skills}>
            {job.requiredSkills.map((s) => (
              <View key={s} style={styles.skill}><Text style={styles.skillText}>{s}</Text></View>
            ))}
          </View>
        </>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.applyBtn} onPress={apply}>
          <Text style={styles.applyText}>Apply Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={saveJob}>
          <Text style={styles.saveText}>Save ♡</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  title: { fontSize: 24, fontWeight: '700' },
  company: { fontSize: 16, color: '#666', marginTop: 4 },
  meta: { color: '#888', marginTop: 4 },
  salary: { fontWeight: '600', marginTop: 12, fontSize: 16 },
  section: { fontWeight: '600', fontSize: 16, marginTop: 24, marginBottom: 8 },
  desc: { color: '#444', lineHeight: 22 },
  skills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skill: { backgroundColor: '#E8F4FD', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  skillText: { color: '#0A66C2', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 32, marginBottom: 40 },
  applyBtn: { flex: 1, backgroundColor: '#0A66C2', padding: 16, borderRadius: 8 },
  applyText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  saveBtn: { padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#0A66C2' },
  saveText: { color: '#0A66C2', fontWeight: '600' },
});
