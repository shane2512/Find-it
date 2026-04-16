import { useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { getStoredSession } from '../lib/session';
import {
  calculateMatchScore,
  Coordinates,
  ItemCandidate,
  MIN_MATCH_SCORE,
  ReportType,
} from '../lib/matching';

const CATEGORIES = ['Wallet', 'Phone', 'Keys', 'Bag', 'ID Card', 'Other'];

export default function ReportScreen() {
  const [type, setType] = useState<ReportType>('lost');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });

    if (result.canceled) {
      return;
    }

    setImageUri(result.assets[0].uri);
  };

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location permission is required to tag this report.');
      return;
    }

    const current = await Location.getCurrentPositionAsync({});
    setCoordinates({
      lat: current.coords.latitude,
      lng: current.coords.longitude,
    });

    Alert.alert('Success', 'Location tagged for this report.');
  };

  const submitReport = async () => {
    if (!title.trim() || !category) {
      Alert.alert('Missing fields', 'Title and category are required.');
      return;
    }

    setLoading(true);

    const session = await getStoredSession();

    if (!session) {
      setLoading(false);
      Alert.alert('Auth error', 'You must be signed in to post a report.');
      return;
    }

    let imageUrl: string | null = null;

    if (imageUri) {
      try {
        const extension = imageUri.split('.').pop()?.toLowerCase();
        const normalizedExtension =
          extension && ['jpg', 'jpeg', 'png', 'webp'].includes(extension) ? extension : 'jpg';
        const fileName = `${session.id}-${Date.now()}.${normalizedExtension}`;
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const arrayBuffer = decode(base64);
        const contentType =
          normalizedExtension === 'png'
            ? 'image/png'
            : normalizedExtension === 'webp'
              ? 'image/webp'
              : 'image/jpeg';

        const { error: uploadError } = await supabase.storage
          .from('item-images')
          .upload(fileName, arrayBuffer, { contentType, upsert: false });

        if (uploadError) {
          setLoading(false);
          Alert.alert('Upload error', uploadError.message);
          return;
        }

        imageUrl = supabase.storage.from('item-images').getPublicUrl(fileName).data.publicUrl;
      } catch (error) {
        setLoading(false);
        const message = error instanceof Error ? error.message : 'Unable to process selected image.';
        Alert.alert('Upload error', message);
        return;
      }
    }

    const { data: insertedRows, error: insertError } = await supabase
      .from('items')
      .insert({
        user_id: session.id,
        type,
        title: title.trim(),
        description: description.trim() || null,
        category,
        image_url: imageUrl,
        lat: coordinates?.lat ?? null,
        lng: coordinates?.lng ?? null,
      })
      .select('id')
      .limit(1);

    setLoading(false);

    if (insertError) {
      Alert.alert('Save error', insertError.message);
      return;
    }

    const insertedId = insertedRows?.[0]?.id as string | undefined;

    if (insertedId) {
      const oppositeType: ReportType = type === 'lost' ? 'found' : 'lost';
      const { data: candidates, error: candidatesError } = await supabase
        .from('items')
        .select('id, user_id, type, title, description, category, lat, lng, status')
        .eq('type', oppositeType)
        .eq('status', 'open')
        .neq('user_id', session.id);

      if (!candidatesError && candidates) {
        const draft = {
          type,
          title: title.trim(),
          description: description.trim(),
          category,
          coords: coordinates,
        };

        const strongMatches = (candidates as ItemCandidate[])
          .map((candidate) => ({
            candidate,
            score: calculateMatchScore(draft, candidate),
          }))
          .filter(({ score }) => score >= MIN_MATCH_SCORE)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        for (const entry of strongMatches) {
          const lostItemId = type === 'lost' ? insertedId : entry.candidate.id;
          const foundItemId = type === 'found' ? insertedId : entry.candidate.id;

          const { data: matchRows } = await supabase
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

          const matchId = matchRows?.[0]?.id as string | undefined;

          if (!matchId) {
            continue;
          }

          const lostUserId = type === 'lost' ? session.id : entry.candidate.user_id;
          const foundUserId = type === 'found' ? session.id : entry.candidate.user_id;

          await supabase.from('chat_threads').upsert(
            {
              match_id: matchId,
              lost_user_id: lostUserId,
              found_user_id: foundUserId,
            },
            { onConflict: 'match_id' }
          );
        }
      }
    }

    Alert.alert('Posted', 'Your report has been created and match scan completed.');
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.typeRow}>
        {(['lost', 'found'] as const).map((value) => (
          <TouchableOpacity
            key={value}
            style={[styles.typeButton, type === value && styles.typeButtonActive]}
            onPress={() => setType(value)}
          >
            <Text style={[styles.typeButtonText, type === value && styles.typeButtonTextActive]}>
              {value.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.input}
        placeholder="Title (for example: Blue wallet)"
        onChangeText={setTitle}
        value={title}
      />

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Description"
        multiline
        onChangeText={setDescription}
        value={description}
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.categoryWrap}>
        {CATEGORIES.map((value) => (
          <TouchableOpacity
            key={value}
            style={[styles.categoryChip, category === value && styles.categoryChipActive]}
            onPress={() => setCategory(value)}
          >
            <Text style={[styles.categoryText, category === value && styles.categoryTextActive]}>
              {value}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.secondaryButton} onPress={pickImage}>
        <Text style={styles.secondaryButtonText}>{imageUri ? 'Retake Photo' : 'Take Photo'}</Text>
      </TouchableOpacity>

      {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} /> : null}

      <TouchableOpacity style={styles.secondaryButton} onPress={getLocation}>
        <Text style={styles.secondaryButtonText}>
          {coordinates ? 'Location Tagged' : 'Tag Current Location'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.primaryButton} onPress={submitReport} disabled={loading}>
        <Text style={styles.primaryButtonText}>{loading ? 'Posting...' : 'Post Report'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  typeRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  typeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
    marginRight: 10,
  },
  typeButtonActive: {
    borderColor: '#FF6B35',
    backgroundColor: '#FF6B35',
  },
  typeButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  label: {
    marginBottom: 8,
    fontWeight: '600',
    color: '#111827',
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryChipActive: {
    borderColor: '#FF6B35',
    backgroundColor: '#FF6B35',
  },
  categoryText: {
    color: '#374151',
    fontSize: 13,
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 14,
  },
  preview: {
    width: '100%',
    height: 190,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#E5E7EB',
  },
  primaryButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 18,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
