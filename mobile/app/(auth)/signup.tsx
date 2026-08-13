import { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';

export default function SignupScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [role, setRole] = useState<'STUDENT' | 'EMPLOYER'>('STUDENT');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSignup() {
    try {
      const res = await api<{ accessToken: string; refreshToken: string; user: { id: string; email: string; role: 'STUDENT' | 'EMPLOYER' | 'ADMIN' } }>(
        '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            email,
            password,
            role,
            fullName: name,
            businessName: role === 'EMPLOYER' ? name : undefined,
          }),
        },
      );
      await setAuth(res.accessToken, res.refreshToken, res.user);
      router.replace('/(tabs)/home');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Signup failed');
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.roleRow}>
        <TouchableOpacity style={[styles.roleBtn, role === 'STUDENT' && styles.roleActive]} onPress={() => setRole('STUDENT')}>
          <Text style={role === 'STUDENT' ? styles.roleActiveText : styles.roleText}>Job Seeker</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.roleBtn, role === 'EMPLOYER' && styles.roleActive]} onPress={() => setRole('EMPLOYER')}>
          <Text style={role === 'EMPLOYER' ? styles.roleActiveText : styles.roleText}>Employer</Text>
        </TouchableOpacity>
      </View>
      <TextInput style={styles.input} placeholder={role === 'EMPLOYER' ? 'Business Name' : 'Full Name'} value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Password (min 8 chars)" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.btn} onPress={handleSignup}>
        <Text style={styles.btnText}>Create Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  roleBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#0A66C2' },
  roleActive: { backgroundColor: '#0A66C2' },
  roleText: { textAlign: 'center', color: '#0A66C2' },
  roleActiveText: { textAlign: 'center', color: '#fff' },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 14, marginBottom: 12 },
  btn: { backgroundColor: '#0A66C2', padding: 16, borderRadius: 8, marginTop: 8 },
  btnText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
});
