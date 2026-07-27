import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { clearStoredSession, getStoredSession, login } from '../api';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const bootstrapSession = async () => {
      try {
        const session = await getStoredSession();
        if (session?.token) {
          navigation.replace('Walk', { token: session.token, walkerName: session.user?.name || session.email?.split('@')[0] || 'Walker' });
        }
      } catch (error) {
        await clearStoredSession();
      }
    };

    bootstrapSession();
  }, [navigation]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing credentials', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      const token = result?.token;
      if (!token) {
        throw new Error('No token returned by the backend');
      }
      navigation.replace('Walk', { token, walkerName: result.user?.name || email.split('@')[0] });
    } catch (error) {
      const message = error?.message || 'Unable to login.';
      const friendlyMessage = message.includes('Network') || message.includes('fetch') || message.includes('Failed to fetch')
        ? 'Unable to reach the backend from this device. Check that the app is using the correct API address and that the phone and computer are on the same network.'
        : message;
      Alert.alert('Login failed', friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Text style={styles.title}>Alfiyay Walker</Text>
      <Text style={styles.subtitle}>Sign in to manage your walks</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>Your login will connect the mobile app to your Hostinger backend.</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#f2f7ff',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    color: '#0d3b66',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
    color: '#1d2d50',
  },
  input: {
    height: 52,
    borderColor: '#9bb7d4',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#ffffff',
  },
  button: {
    backgroundColor: '#0077cc',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  hint: {
    marginTop: 24,
    fontSize: 14,
    color: '#445668',
    textAlign: 'center',
  },
});
