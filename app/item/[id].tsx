import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';

type Item = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  type: 'lost' | 'found';
  image_url: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
};

export default function ItemDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);

  const itemId = useMemo(() => {
    if (Array.isArray(params.id)) {
      return params.id[0];
    }

    return params.id;
  }, [params.id]);

  useEffect(() => {
    if (!itemId) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase
      .from('items')
      .select('*')
      .eq('id', itemId)
      .single()
      .then(({ data }) => {
        if (!mounted) {
          return;
        }

        setItem((data as Item | null) ?? null);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [itemId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Item not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {item.image_url ? <Image source={{ uri: item.image_url }} style={styles.image} /> : null}

      <View
        style={[
          styles.typeBadge,
          item.type === 'lost' ? styles.typeBadgeLost : styles.typeBadgeFound,
        ]}
      >
        <Text
          style={[
            styles.typeBadgeText,
            item.type === 'lost' ? styles.typeBadgeTextLost : styles.typeBadgeTextFound,
          ]}
        >
          {item.type.toUpperCase()}
        </Text>
      </View>

      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.meta}>{item.category || 'General'}</Text>
      <Text style={styles.description}>{item.description || 'No description provided.'}</Text>

      {typeof item.lat === 'number' && typeof item.lng === 'number' ? (
        <View style={styles.locationCard}>
          <Text style={styles.locationText}>
            Location: {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
          </Text>
        </View>
      ) : null}

      <Text style={styles.date}>Reported: {new Date(item.created_at).toLocaleString()}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 15,
  },
  image: {
    width: '100%',
    height: 240,
    borderRadius: 14,
    marginBottom: 12,
    backgroundColor: '#E5E7EB',
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
  },
  typeBadgeLost: {
    backgroundColor: '#FFE7DE',
  },
  typeBadgeFound: {
    backgroundColor: '#E7F7ED',
  },
  typeBadgeText: {
    fontWeight: '700',
    fontSize: 12,
  },
  typeBadgeTextLost: {
    color: '#FF6B35',
  },
  typeBadgeTextFound: {
    color: '#16A34A',
  },
  title: {
    fontSize: 24,
    color: '#111827',
    fontWeight: '700',
    marginBottom: 4,
  },
  meta: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1F2937',
    marginBottom: 12,
  },
  locationCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  locationText: {
    color: '#374151',
    fontSize: 13,
  },
  date: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
