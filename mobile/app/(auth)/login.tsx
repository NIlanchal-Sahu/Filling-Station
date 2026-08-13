import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';

export default function LoginScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    try {
      const res = await api<{ accessToken: string; refreshToken: string; user: { id: string; email: string; role: 'STUDENT' | 'EMPLOYER' | 'ADMIN' } }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ email, password }) },
      );
      await setAuth(res.accessToken, res.refreshToken, res.user);
      router.replace('/(tabs)/home');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
        <Text style={styles.btnText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>Demo: student@demo.com / Password123!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  input: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 16 },
  btn: { backgroundColor: '#0A66C2', padding: 16, borderRadius: 8, marginTop: 8 },
  btnText: { color: '#fff', textAlign: 'center', fontWeight: '600', fontSize: 16 },
  hint: { marginTop: 16, fontSize: 12, color: '#666', textAlign: 'center' },
});
