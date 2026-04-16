import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getStoredSession } from '../../lib/session';

type ChatMessage = {
  id: string;
  thread_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
};

export default function ChatThreadScreen() {
  const params = useLocalSearchParams<{ threadId?: string | string[] }>();
  const threadId = useMemo(() => {
    if (Array.isArray(params.threadId)) {
      return params.threadId[0];
    }

    return params.threadId;
  }, [params.threadId]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!threadId) {
      return;
    }

    const session = await getStoredSession();
    setSessionUserId(session?.id ?? null);

    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, thread_id, sender_user_id, body, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error) {
      return;
    }

    setMessages((data as ChatMessage[]) ?? []);
  }, [threadId]);

  useFocusEffect(
    useCallback(() => {
      loadMessages();
    }, [loadMessages])
  );

  const sendMessage = async () => {
    const text = input.trim();

    if (!text || !threadId) {
      return;
    }

    const session = await getStoredSession();

    if (!session) {
      Alert.alert('Auth error', 'Please log in again.');
      return;
    }

    setSending(true);

    const { error } = await supabase.from('chat_messages').insert({
      thread_id: threadId,
      sender_user_id: session.id,
      body: text,
    });

    setSending(false);

    if (error) {
      Alert.alert('Message error', error.message);
      return;
    }

    setInput('');
    await loadMessages();
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={messages.length ? styles.messagesList : styles.emptyList}
        renderItem={({ item }) => {
          const isMine = item.sender_user_id === sessionUserId;

          return (
            <View style={[styles.messageBubble, isMine ? styles.mine : styles.theirs]}>
              <Text style={[styles.messageText, isMine ? styles.mineText : styles.theirsText]}>
                {item.body}
              </Text>
              <Text style={[styles.meta, isMine ? styles.mineMeta : styles.theirsMeta]}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>No messages yet. Start chatting.</Text>}
      />

      <View style={styles.composerRow}>
        <TextInput
          style={styles.input}
          placeholder="Write a message"
          value={input}
          onChangeText={setInput}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={sending}>
          <Text style={styles.sendText}>{sending ? '...' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  messagesList: {
    padding: 16,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: '#FF6B35',
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  mineText: {
    color: '#FFFFFF',
  },
  theirsText: {
    color: '#1F2937',
  },
  meta: {
    marginTop: 4,
    fontSize: 10,
  },
  mineMeta: {
    color: '#FFE7DE',
  },
  theirsMeta: {
    color: '#9CA3AF',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
  },
  sendButton: {
    marginLeft: 8,
    borderRadius: 10,
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sendText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
