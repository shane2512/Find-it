import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { saveStoredSession } from '../lib/session';

type AuthResult = {
  id: string;
  email: string;
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      Alert.alert('Missing fields', 'Enter both email and password.');
      return;
    }

    setLoading(true);

    const response = isNewUser
      ? await supabase.rpc('register_app_user', {
          p_email: trimmedEmail,
          p_password: password,
        })
      : await supabase.rpc('login_app_user', {
          p_email: trimmedEmail,
          p_password: password,
        });

    setLoading(false);

    if (response.error) {
      Alert.alert('Auth error', response.error.message);
      return;
    }

    const sessionUser = (Array.isArray(response.data) ? response.data[0] : null) as
      | AuthResult
      | null;

    if (!sessionUser?.id || !sessionUser?.email) {
      Alert.alert('Auth error', 'Invalid response from login service.');
      return;
    }

    await saveStoredSession({ id: sessionUser.id, email: sessionUser.email });

    router.replace('/(tabs)/home');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardWrap}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Lost and Found</Text>
        <Text style={styles.subtitle}>Sign in with email and password</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          value={email}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          onChangeText={setPassword}
          value={password}
        />

        <TouchableOpacity style={styles.primaryButton} onPress={handleAuth} disabled={loading}>
          <Text style={styles.primaryButtonText}>
            {loading ? 'Please wait...' : isNewUser ? 'Sign Up' : 'Log In'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={() => setIsNewUser((prev) => !prev)}>
          <Text style={styles.linkText}>
            {isNewUser ? 'Already have an account? Log in' : 'New user? Sign up'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardWrap: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1F2937',
  },
  subtitle: {
    textAlign: 'center',
    color: '#6B7280',
    marginBottom: 18,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 16,
  },
  linkText: {
    color: '#6B7280',
    textAlign: 'center',
    fontSize: 14,
  },
});