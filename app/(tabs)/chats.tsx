import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getStoredSession } from '../../lib/session';

type ChatThread = {
  id: string;
  match_id: string;
  lost_user_id: string;
  found_user_id: string;
  created_at: string;
};

type MatchRecord = {
  id: string;
  lost_item_id: string;
  found_item_id: string;
  score: number;
};

type ItemRecord = {
  id: string;
  title: string;
  category: string | null;
};

type LatestMessage = {
  thread_id: string;
  body: string;
  created_at: string;
};

type ChatCard = {
  threadId: string;
  title: string;
  subtitle: string;
  score: number;
  latestMessage: string;
  updatedAt: string;
};

export default function ChatsScreen() {
  const [threads, setThreads] = useState<ChatCard[]>([]);
  const [loading, setLoading] = useState(true);

  const loadChats = useCallback(async () => {
    setLoading(true);

    const session = await getStoredSession();

    if (!session) {
      setThreads([]);
      setLoading(false);
      return;
    }

    const { data: threadRows, error: threadError } = await supabase
      .from('chat_threads')
      .select('id, match_id, lost_user_id, found_user_id, created_at')
      .or(`lost_user_id.eq.${session.id},found_user_id.eq.${session.id}`)
      .order('created_at', { ascending: false });

    if (threadError || !threadRows?.length) {
      setThreads([]);
      setLoading(false);
      return;
    }

    const typedThreads = threadRows as ChatThread[];
    const matchIds = typedThreads.map((thread) => thread.match_id);

    const { data: matchRows } = await supabase
      .from('matches')
      .select('id, lost_item_id, found_item_id, score')
      .in('id', matchIds);

    const matchMap = new Map<string, MatchRecord>();
    const itemIds = new Set<string>();

    (matchRows as MatchRecord[] | null)?.forEach((match) => {
      matchMap.set(match.id, match);
      itemIds.add(match.lost_item_id);
      itemIds.add(match.found_item_id);
    });

    const { data: itemRows } = await supabase
      .from('items')
      .select('id, title, category')
      .in('id', Array.from(itemIds));

    const itemMap = new Map<string, ItemRecord>();

    (itemRows as ItemRecord[] | null)?.forEach((item) => {
      itemMap.set(item.id, item);
    });

    const { data: messageRows } = await supabase
      .from('chat_messages')
      .select('thread_id, body, created_at')
      .in(
        'thread_id',
        typedThreads.map((thread) => thread.id)
      )
      .order('created_at', { ascending: false });

    const latestMessageMap = new Map<string, LatestMessage>();

    (messageRows as LatestMessage[] | null)?.forEach((message) => {
      if (!latestMessageMap.has(message.thread_id)) {
        latestMessageMap.set(message.thread_id, message);
      }
    });

    const cards = typedThreads
      .map((thread) => {
        const match = matchMap.get(thread.match_id);
        if (!match) {
          return null;
        }

        const lostItem = itemMap.get(match.lost_item_id);
        const foundItem = itemMap.get(match.found_item_id);
        const latestMessage = latestMessageMap.get(thread.id);

        return {
          threadId: thread.id,
          title: `${lostItem?.title || 'Lost item'} ↔ ${foundItem?.title || 'Found item'}`,
          subtitle: `Score ${match.score} • ${(lostItem?.category || foundItem?.category || 'General').toString()}`,
          score: match.score,
          latestMessage: latestMessage?.body || 'No messages yet. Start recovery chat.',
          updatedAt: latestMessage?.created_at || thread.created_at,
        } as ChatCard;
      })
      .filter((card): card is ChatCard => Boolean(card))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    setThreads(cards);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [loadChats])
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={threads}
        keyExtractor={(item) => item.threadId}
        contentContainerStyle={threads.length ? styles.list : styles.emptyList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              router.push({ pathname: '/chat/[threadId]', params: { threadId: item.threadId } })
            }
          >
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
            <Text numberOfLines={2} style={styles.messagePreview}>
              {item.latestMessage}
            </Text>
            <Text style={styles.updatedAt}>{new Date(item.updatedAt).toLocaleString()}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{loading ? 'Loading chats...' : 'No chats yet.'}</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  list: {
    padding: 16,
  },
  emptyList: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  messagePreview: {
    marginTop: 8,
    fontSize: 13,
    color: '#374151',
  },
  updatedAt: {
    marginTop: 8,
    fontSize: 11,
    color: '#9CA3AF',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
});
