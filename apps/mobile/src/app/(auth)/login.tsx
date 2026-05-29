import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const onLogin = async () => {
    if (!email || !password) {
      setError('Please fill all fields');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await useAuthStore.getState().login(email, password);
      router.replace('/(tabs)/');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Login failed';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>SalesTrack</Text>
        <Text style={styles.subtitle}>Agent Portal</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, emailFocused && styles.inputFocused]}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="agent@example.com"
          placeholderTextColor="#B0AEA6"
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={[styles.input, passwordFocused && styles.inputFocused]}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#B0AEA6"
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonLoading]}
          onPress={onLogin}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
  },
  inner: {
    paddingHorizontal: 32,
  },
  logo: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1D9E75',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888780',
    marginBottom: 32,
  },
  label: {
    fontSize: 13,
    color: '#444441',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    height: 48,
    borderWidth: 0.5,
    borderColor: '#D3D1C7',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 14,
    marginBottom: 16,
    color: '#2C2C2A',
    backgroundColor: '#fff',
  },
  inputFocused: {
    borderColor: '#1D9E75',
    borderWidth: 1.5,
  },
  error: {
    color: '#E24B4A',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 12,
  },
  button: {
    height: 48,
    backgroundColor: '#1D9E75',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonLoading: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
