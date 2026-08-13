import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { api } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';

export default function MessagesScreen() {
  const token = useAuthStore((s) => s.accessToken);
  const [conversations, setConversations] = useState<Array<{ id: string; participants: Array<{ email: string }>; lastMessage?: { content: string } }>>([]);

  useEffect(() => {
    if (!token) return;
    api<typeof conversations>('/conversations', { token }).then(setConversations).catch(console.error);
  }, [token]);

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.participants[0]?.email}</Text>
            <Text style={styles.preview} numberOfLines={1}>{item.lastMessage?.content || 'No messages'}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No conversations</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F2EF', padding: 12 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 8 },
  title: { fontWeight: '600' },
  preview: { color: '#666', marginTop: 4, fontSize: 13 },
  empty: { textAlign: 'center', marginTop: 40, color: '#666' },
});
