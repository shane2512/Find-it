import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { getStoredSession } from '../lib/session';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

export default function IndexScreen() {
  const [authState, setAuthState] = useState<AuthState>('loading');

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const session = await getStoredSession();

      if (!mounted) {
        return;
      }

      setAuthState(session ? 'authenticated' : 'unauthenticated');
    };

    loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  if (authState === 'loading') {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return <Redirect href={authState === 'authenticated' ? '/(tabs)/home' : '/login'} />;
}

const styles = StyleSheet.create({
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});