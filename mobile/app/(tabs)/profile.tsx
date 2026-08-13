import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/auth-store';

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  async function handleLogout() {
    await logout();
    router.replace('/');
  }

  return (
    <View style={styles.container}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{user?.email?.[0]?.toUpperCase()}</Text></View>
      <Text style={styles.email}>{user?.email}</Text>
      <Text style={styles.role}>{user?.role}</Text>

      <TouchableOpacity style={styles.btn} onPress={() => Alert.alert('Profile', 'Edit profile on web app')}>
        <Text style={styles.btnText}>Edit Profile</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnOutline} onPress={() => Alert.alert('Notifications', 'Push via FCM in production')}>
        <Text style={styles.btnOutlineText}>Notification Settings</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.logout} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#0A66C2', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  email: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  role: { color: '#666', marginTop: 4, marginBottom: 32 },
  btn: { backgroundColor: '#0A66C2', padding: 14, borderRadius: 8, width: '100%', marginBottom: 12 },
  btnText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  btnOutline: { borderWidth: 1, borderColor: '#0A66C2', padding: 14, borderRadius: 8, width: '100%', marginBottom: 12 },
  btnOutlineText: { color: '#0A66C2', textAlign: 'center', fontWeight: '600' },
  logout: { marginTop: 24 },
  logoutText: { color: '#c00', fontWeight: '600' },
});
