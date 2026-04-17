import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker } from 'react-native-maps';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';

type MapItem = {
  id: string;
  title: string;
  category: string | null;
  type: 'lost' | 'found';
  lat: number | null;
  lng: number | null;
};

const DEFAULT_REGION = {
  latitude: 13.0827,
  longitude: 80.2707,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

export default function MapScreen() {
  const [items, setItems] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase
      .from('items')
      .select('id, title, category, type, lat, lng')
      .eq('status', 'open')
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .then(({ data }) => {
        if (!mounted) {
          return;
        }

        setItems((data as MapItem[] | null) ?? []);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const region = useMemo(() => {
    const firstWithCoords = items.find(
      (item) => typeof item.lat === 'number' && typeof item.lng === 'number'
    );

    if (!firstWithCoords || typeof firstWithCoords.lat !== 'number' || typeof firstWithCoords.lng !== 'number') {
      return DEFAULT_REGION;
    }

    return {
      latitude: firstWithCoords.lat,
      longitude: firstWithCoords.lng,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
  }, [items]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webWrap}>
        <Text style={styles.webTitle}>Open Items Map (Web Fallback)</Text>
        <Text style={styles.webSub}>Tap an item to open its location in Google Maps.</Text>

        {loading ? <Text style={styles.webSub}>Loading...</Text> : null}

        {!loading && !items.length ? <Text style={styles.webSub}>No open items with location yet.</Text> : null}

        {items
          .filter((item) => typeof item.lat === 'number' && typeof item.lng === 'number')
          .map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.webRow}
              onPress={() => Linking.openURL(`https://maps.google.com/?q=${item.lat},${item.lng}`)}
            >
              <Text style={styles.webRowTitle}>{item.title}</Text>
              <Text style={styles.webRowSub}>
                {item.type.toUpperCase()} | {item.category || 'General'}
              </Text>
            </TouchableOpacity>
          ))}
      </View>
    );
  }

  return (
    <MapView style={styles.map} initialRegion={region} showsUserLocation>
      {items
        .filter((item) => typeof item.lat === 'number' && typeof item.lng === 'number')
        .map((item) => (
          <Marker
            key={item.id}
            coordinate={{ latitude: item.lat as number, longitude: item.lng as number }}
            pinColor={item.type === 'lost' ? '#FF6B35' : '#2D9E5F'}
          >
            <Callout onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{item.title}</Text>
                <Text style={styles.calloutSub}>
                  {item.type.toUpperCase()} | {item.category || 'General'}
                </Text>
                <Text style={styles.calloutLink}>Tap to view</Text>
              </View>
            </Callout>
          </Marker>
        ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  callout: {
    width: 180,
    padding: 8,
  },
  calloutTitle: {
    fontWeight: '700',
    fontSize: 14,
  },
  calloutSub: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
  },
  calloutLink: {
    color: '#FF6B35',
    fontSize: 12,
    marginTop: 4,
  },
  webWrap: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  webTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  webSub: {
    color: '#6B7280',
    marginBottom: 10,
  },
  webRow: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  webRowTitle: {
    color: '#111827',
    fontWeight: '700',
  },
  webRowSub: {
    color: '#6B7280',
    marginTop: 2,
    fontSize: 12,
  },
});