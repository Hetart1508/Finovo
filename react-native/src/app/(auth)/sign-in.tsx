import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiBaseUrl } from '@/api/client';
import { useAuth } from '@/features/auth/auth-provider';
import { colors, radii, shadows, spacing, typography } from '@/theme/tokens';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (caught) {
      const message = (caught as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message || 'Unable to sign in. Check the API URL and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <View style={styles.brand}>
          <View style={styles.brandIcon}>
            <Ionicons name="wallet-outline" size={30} color={colors.primary} />
          </View>
          <Text style={styles.brandTitle}>Finovo AI</Text>
          <Text style={styles.brandSubtitle}>Expense intelligence, now on mobile.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in with the same account you use on the website.</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={email}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="current-password"
              onChangeText={setPassword}
              onSubmitEditing={handleSignIn}
              placeholder="Your password"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={styles.input}
              value={password}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={handleSignIn}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, submitting && styles.buttonDisabled]}>
            {submitting ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.buttonText}>Sign in</Text>}
          </Pressable>

          <Text style={styles.apiHint}>API: {apiBaseUrl}</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardView: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.xl },
  brand: { alignItems: 'center' },
  brandIcon: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.md,
  },
  brandTitle: { ...typography.display, color: colors.text },
  brandSubtitle: { ...typography.body, color: colors.muted, marginTop: spacing.xs },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md, ...shadows.card },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.muted, marginBottom: spacing.sm },
  fieldGroup: { gap: spacing.xs },
  label: { ...typography.label, color: colors.text },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 16,
  },
  error: { ...typography.caption, color: colors.danger },
  button: { minHeight: 50, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  buttonPressed: { backgroundColor: colors.primaryPressed },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { ...typography.label, color: colors.surface },
  apiHint: { ...typography.caption, color: colors.muted, textAlign: 'center' },
});
