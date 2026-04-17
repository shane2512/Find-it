import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../../lib/supabase';
import { getStoredSession } from '../../lib/session';
import { calculateMatchScore, Coordinates, ItemCandidate, MIN_MATCH_SCORE } from '../../lib/matching';

type Item = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string | null;
  type: 'lost' | 'found';
  image_url: string | null;
  lat: number | null;
  lng: number | null;
  created_at: string;
};

type MatchCard = {
  id: string;
  score: number;
  threadId: string;
  item: {
    id: string;
    title: string;
    category: string | null;
    created_at: string;
  };
};

export default function ItemDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const [item, setItem] = useState<Item | null>(null);
  const [matches, setMatches] = useState<MatchCard[]>([]);
  const [matching, setMatching] = useState(false);
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

  const runMatcher = async () => {
    if (!item) {
      return;
    }

    const session = await getStoredSession();

    if (!session) {
      Alert.alert('Auth error', 'Please log in again.');
      return;
    }

    setMatching(true);

    const oppositeType = item.type === 'lost' ? 'found' : 'lost';
    const { data: candidates, error: candidatesError } = await supabase
      .from('items')
      .select('id, user_id, type, title, description, category, lat, lng, status, created_at')
      .eq('type', oppositeType)
      .eq('status', 'open')
      .neq('user_id', session.id)
      .neq('id', item.id);

    if (candidatesError || !candidates) {
      setMatching(false);
      Alert.alert('Match error', 'Unable to search matches right now.');
      return;
    }

    const draft = {
      type: item.type,
      title: item.title,
      description: item.description || '',
      category: item.category || '',
      coords:
        typeof item.lat === 'number' && typeof item.lng === 'number'
          ? ({ lat: item.lat, lng: item.lng } as Coordinates)
          : null,
    };

    const strongMatches = (candidates as (ItemCandidate & { created_at: string })[])
      .map((candidate) => ({
        candidate,
        score: calculateMatchScore(draft, candidate),
      }))
      .filter(({ score }) => score >= MIN_MATCH_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const cards: MatchCard[] = [];

    for (const entry of strongMatches) {
      const lostItemId = item.type === 'lost' ? item.id : entry.candidate.id;
      const foundItemId = item.type === 'found' ? item.id : entry.candidate.id;

      const { data: matchRows, error: matchError } = await supabase
        .from('matches')
        .upsert(
          {
            lost_item_id: lostItemId,
            found_item_id: foundItemId,
            score: entry.score,
            status: 'open',
          },
          { onConflict: 'lost_item_id,found_item_id' }
        )
        .select('id')
        .limit(1);

      if (matchError || !matchRows?.[0]?.id) {
        continue;
      }

      const matchId = matchRows[0].id as string;
      const lostUserId = item.type === 'lost' ? item.user_id : entry.candidate.user_id;
      const foundUserId = item.type === 'found' ? item.user_id : entry.candidate.user_id;

      const { data: threadRows, error: threadError } = await supabase
        .from('chat_threads')
        .upsert(
          {
            match_id: matchId,
            lost_user_id: lostUserId,
            found_user_id: foundUserId,
          },
          { onConflict: 'match_id' }
        )
        .select('id')
        .limit(1);

      if (threadError || !threadRows?.[0]?.id) {
        continue;
      }

      cards.push({
        id: matchId,
        score: entry.score,
        threadId: threadRows[0].id as string,
        item: {
          id: entry.candidate.id,
          title: entry.candidate.title,
          category: entry.candidate.category,
          created_at: entry.candidate.created_at,
        },
      });
    }

    setMatches(cards);
    setMatching(false);
  };

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

      <TouchableOpacity style={styles.matchButton} onPress={runMatcher} disabled={matching}>
        <Text style={styles.matchButtonText}>
          {matching ? 'Finding Matches...' : 'Find Matches'}
        </Text>
      </TouchableOpacity>

      {matches.length ? (
        <View style={styles.matchesWrap}>
          <Text style={styles.matchesTitle}>Potential Matches</Text>
          {matches.map((match) => (
            <View key={match.id} style={styles.matchCard}>
              <View style={styles.matchBody}>
                <Text style={styles.matchItemTitle}>{match.item.title}</Text>
                <Text style={styles.matchMeta}>
                  Score {match.score} | {match.item.category || 'General'}
                </Text>
                <Text style={styles.matchMeta}>
                  {new Date(match.item.created_at).toLocaleDateString()}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.chatButton}
                onPress={() =>
                  router.push({ pathname: '/chat/[threadId]', params: { threadId: match.threadId } })
                }
              >
                <Text style={styles.chatButtonText}>Open Chat</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      {typeof item.lat === 'number' && typeof item.lng === 'number' ? (
        <View style={styles.locationCard}>
          {Platform.OS === 'web' ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(`https://maps.google.com/?q=${item.lat},${item.lng}`)}
            >
              <Text style={styles.webLocationLink}>View on Google Maps</Text>
            </TouchableOpacity>
          ) : (
            <MapView
              style={styles.locationMap}
              initialRegion={{
                latitude: item.lat,
                longitude: item.lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              scrollEnabled={false}
            >
              <Marker
                coordinate={{ latitude: item.lat, longitude: item.lng }}
                title={item.title}
                description={item.category || 'General'}
              />
            </MapView>
          )}
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
  locationMap: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    marginBottom: 10,
  },
  locationText: {
    color: '#374151',
    fontSize: 13,
  },
  webLocationLink: {
    color: '#C2410C',
    fontWeight: '600',
    marginBottom: 8,
  },
  date: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  matchButton: {
    marginBottom: 12,
    backgroundColor: '#FF6B35',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  matchButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  matchesWrap: {
    marginBottom: 14,
  },
  matchesTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  matchCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  matchBody: {
    marginBottom: 8,
  },
  matchItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  matchMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  chatButton: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FF6B35',
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
});
