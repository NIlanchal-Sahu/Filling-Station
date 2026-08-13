import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function TabIcon({ label }: { label: string }) {
  return <Text style={{ fontSize: 20 }}>{label}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#0A66C2', headerStyle: { backgroundColor: '#0A66C2' }, headerTintColor: '#fff' }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: () => <TabIcon label="🏠" /> }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: () => <TabIcon label="💼" /> }} />
      <Tabs.Screen name="applications" options={{ title: 'Applications', tabBarIcon: () => <TabIcon label="📋" /> }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages', tabBarIcon: () => <TabIcon label="💬" /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: () => <TabIcon label="👤" /> }} />
    </Tabs>
  );
}
