'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SOCKET_URL, api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

interface Conversation {
  id: string;
  participants: Array<{ id: string; email: string }>;
  lastMessage?: { content: string };
}

interface Message {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
}

export default function MessagesPage() {
  const token = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.user?.id);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;
    api<Conversation[]>('/conversations', { token }).then(setConversations).catch(console.error);
  }, [token]);

  useEffect(() => {
    if (!token || !activeId) return;
    api<Message[]>(`/conversations/${activeId}/messages`, { token })
      .then((msgs) => setMessages(msgs.reverse()))
      .catch(console.error);

    const socket = io(`${SOCKET_URL}/chat`, { auth: { token } });
    socket.emit('join', { conversationId: activeId });
    socket.on('message', (msg: Message) => setMessages((prev) => [...prev, msg]));
    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [token, activeId]);

  function sendMessage() {
    if (!text.trim() || !activeId) return;
    socketRef.current?.emit('message', { conversationId: activeId, content: text });
    setText('');
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Messages</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader><CardTitle className="text-base">Conversations</CardTitle></CardHeader>
          <CardContent className="p-0">
            {conversations.map((c) => (
              <button
                key={c.id}
                className={`w-full px-4 py-3 text-left hover:bg-muted ${activeId === c.id ? 'bg-muted' : ''}`}
                onClick={() => setActiveId(c.id)}
              >
                <p className="font-medium text-sm">{c.participants[0]?.email}</p>
                <p className="text-xs text-muted-foreground truncate">{c.lastMessage?.content}</p>
              </button>
            ))}
            {conversations.length === 0 && <p className="p-4 text-sm text-muted-foreground">No conversations</p>}
          </CardContent>
        </Card>
        <Card className="md:col-span-2 flex flex-col min-h-[400px]">
          <CardContent className="flex flex-1 flex-col p-4">
            {activeId ? (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto mb-4">
                  {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.senderId === userId ? 'justify-end' : 'justify-start'}`}>
                      <div className={`rounded-lg px-3 py-2 text-sm max-w-[80%] ${m.senderId === userId ? 'bg-primary text-white' : 'bg-muted'}`}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..." onKeyDown={(e) => e.key === 'Enter' && sendMessage()} />
                  <Button onClick={sendMessage}>Send</Button>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground m-auto">Select a conversation</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
