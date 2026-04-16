import { useCallback, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';

type ItemType = 'lost' | 'found';

type Item = {
  id: string;
  type: ItemType;
  title: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  status: string;
  created_at: string;
};

export default function HomeScreen() {
  const [tab, setTab] = useState<ItemType>('lost');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('type', tab)
      .eq('status', 'open')
      .order('created_at', { ascending: false });

    if (error || !data) {
      setItems([]);
      setLoading(false);
      return;
    }

    setItems(data as Item[]);
    setLoading(false);
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabsRow}>
        {(['lost', 'found'] as const).map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.tab, tab === type && styles.activeTab]}
            onPress={() => setTab(type)}
          >
            <Text style={[styles.tabLabel, tab === type && styles.activeTabLabel]}>
              {type.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={items.length === 0 ? styles.emptyList : styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
          >
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.thumb} />
            ) : (
              <View style={styles.thumbPlaceholder}>
                <Text style={styles.thumbPlaceholderText}>No Image</Text>
              </View>
            )}

            <View style={styles.cardBody}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>
                {item.category || 'General'} | {new Date(item.created_at).toLocaleDateString()}
              </Text>
              <Text style={styles.description} numberOfLines={2}>
                {item.description || 'No description provided.'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{loading ? 'Loading...' : 'No open reports yet.'}</Text>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/report')}>
        <Text style={styles.fabLabel}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#FF6B35',
  },
  tabLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  activeTabLabel: {
    color: '#FF6B35',
  },
  list: {
    padding: 16,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },
  thumbPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholderText: {
    fontSize: 10,
    color: '#6B7280',
  },
  cardBody: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  meta: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  description: {
    marginTop: 5,
    fontSize: 13,
    color: '#374151',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B35',
    elevation: 4,
  },
  fabLabel: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 32,
  },
});
