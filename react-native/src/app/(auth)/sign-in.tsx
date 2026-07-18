import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authApi, type RegistrationDetails } from '@/api/auth';
import { useAuth } from '@/features/auth/auth-provider';
import { colors, radii, shadows, spacing, typography } from '@/theme/tokens';

WebBrowser.maybeCompleteAuthSession();

type AuthTab = 'login' | 'register';
type LoginStep = 'login' | 'forgot' | 'reset';
type RegisterStep = 'details' | 'verify';

const passwordPolicy = 'Use 10+ characters with uppercase, lowercase, a number, and a special character.';
const fallbackGoogleClientId = 'google-sign-in-not-configured.apps.googleusercontent.com';

const getErrorMessage = (caught: unknown, fallback: string) => {
  const data = (caught as { response?: { data?: { error?: string; message?: string } } })?.response?.data;
  return data?.error || data?.message || (caught instanceof Error ? caught.message : fallback);
};

export default function SignInScreen() {
  const router = useRouter();
  const { finishAuthentication, signIn, signInWithGoogle } = useAuth();
  const [tab, setTab] = useState<AuthTab>('login');
  const [loginStep, setLoginStep] = useState<LoginStep>('login');
  const [registerStep, setRegisterStep] = useState<RegisterStep>('details');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [lastRegistration, setLastRegistration] = useState<RegistrationDetails | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const handledGoogleResponse = useRef<object | null>(null);

  const sharedGoogleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const iosGoogleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || sharedGoogleClientId;
  const androidGoogleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || sharedGoogleClientId;
  const webGoogleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || sharedGoogleClientId;
  const googleConfigured = Boolean(Platform.select({
    ios: iosGoogleClientId,
    android: androidGoogleClientId,
    default: webGoogleClientId,
  }));
  const [googleRequest, googleResponse, promptGoogle] = Google.useAuthRequest(
    {
      iosClientId: iosGoogleClientId || fallbackGoogleClientId,
      androidClientId: androidGoogleClientId || fallbackGoogleClientId,
      webClientId: webGoogleClientId || fallbackGoogleClientId,
      selectAccount: true,
    },
    { scheme: 'finovo', path: 'auth/google' },
  );

  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setTimeout(() => setResendTimer((current) => Math.max(0, current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  useEffect(() => {
    if (!googleResponse) return;
    if (handledGoogleResponse.current === googleResponse) return;
    handledGoogleResponse.current = googleResponse;

    if (googleResponse.type !== 'success') {
      if (googleResponse.type === 'error') setError(googleResponse.error?.message || 'Google sign-in failed.');
      setSubmitting(false);
      return;
    }

    const credential = googleResponse.params.id_token || googleResponse.authentication?.idToken;
    if (!credential) {
      setError('Google did not return an identity token. Check the mobile Google client configuration.');
      setSubmitting(false);
      return;
    }

    void signInWithGoogle(credential)
      .then(() => router.replace('/'))
      .catch((caught) => setError(getErrorMessage(caught, 'Unable to sign in with Google.')))
      .finally(() => setSubmitting(false));
  }, [googleResponse, router, signInWithGoogle]);

  const clearFeedback = () => {
    setError('');
    setNotice('');
  };

  const switchTab = (nextTab: AuthTab) => {
    setTab(nextTab);
    setOtp('');
    clearFeedback();
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    clearFeedback();
    try {
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (caught) {
      setError(getErrorMessage(caught, 'Unable to sign in. Check the API URL and try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!googleConfigured || !googleRequest) return;
    setSubmitting(true);
    clearFeedback();
    const result = await promptGoogle().catch((caught) => {
      setError(getErrorMessage(caught, 'Unable to open Google sign-in.'));
      return null;
    });
    if (!result || result.type === 'cancel' || result.type === 'dismiss') setSubmitting(false);
  };

  const handleRegister = async () => {
    const details = { name: name.trim(), email: email.trim(), password };
    if (!details.name || !details.email || !details.password) {
      setError('Enter your name, email, and password.');
      return;
    }
    if (details.name.length < 2) {
      setError('Enter a name with at least 2 characters.');
      return;
    }
    if (details.password.length < 10) {
      setError('Use a password with at least 10 characters.');
      return;
    }
    setSubmitting(true);
    clearFeedback();
    try {
      const response = await authApi.register(details);
      setLastRegistration(details);
      setRegisterEmail(details.email);
      setOtp('');
      setRegisterStep('verify');
      setResendTimer(300);
      setNotice(response.message || 'OTP sent to your email.');
    } catch (caught) {
      setError(getErrorMessage(caught, 'Unable to create your account.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyRegistration = async () => {
    if (otp.length !== 6) {
      setError('Enter the 6-digit OTP from your email.');
      return;
    }
    setSubmitting(true);
    clearFeedback();
    try {
      await finishAuthentication(await authApi.verifyRegistrationOtp(registerEmail, otp));
      router.replace('/');
    } catch (caught) {
      setError(getErrorMessage(caught, 'Unable to verify the OTP.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('Enter your registered email.');
      return;
    }
    setSubmitting(true);
    clearFeedback();
    try {
      const response = await authApi.forgotPassword(normalizedEmail);
      setResetEmail(normalizedEmail);
      setOtp('');
      setNewPassword('');
      setLoginStep('reset');
      setResendTimer(300);
      setNotice(response.message || 'OTP sent to your email.');
    } catch (caught) {
      setError(getErrorMessage(caught, 'Unable to send the password reset OTP.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (otp.length !== 6 || !newPassword) {
      setError('Enter the 6-digit OTP and your new password.');
      return;
    }
    if (newPassword.length < 10) {
      setError('Use a new password with at least 10 characters.');
      return;
    }
    setSubmitting(true);
    clearFeedback();
    try {
      const response = await authApi.resetPassword(resetEmail, otp, newPassword);
      setOtp('');
      setNewPassword('');
      setPassword('');
      setResetEmail('');
      setResendTimer(0);
      setLoginStep('login');
      setNotice(response.message || 'Password reset successfully. You can now sign in.');
    } catch (caught) {
      setError(getErrorMessage(caught, 'Unable to reset your password.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setSubmitting(true);
    clearFeedback();
    try {
      const response = tab === 'register' && lastRegistration
        ? await authApi.register(lastRegistration)
        : await authApi.forgotPassword(resetEmail);
      setOtp('');
      setResendTimer(300);
      setNotice(response.message || 'A new OTP was sent to your email.');
    } catch (caught) {
      setError(getErrorMessage(caught, 'Unable to resend the OTP.'));
    } finally {
      setSubmitting(false);
    }
  };

  const isRegistrationVerification = tab === 'register' && registerStep === 'verify';
  const isPasswordReset = tab === 'login' && loginStep === 'reset';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <View style={styles.brandIcon}><Text style={styles.brandMark}>F</Text></View>
            <Text style={styles.eyebrow}>WELCOME</Text>
            <Text style={styles.brandTitle}>Finovo AI</Text>
            <Text style={styles.brandSubtitle}>Login with your password or verify your email to create a new account.</Text>
          </View>

          <View style={styles.authShell}>
            <View style={styles.tabs}>
              {(['login', 'register'] as const).map((item) => (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === item }}
                  key={item}
                  onPress={() => switchTab(item)}
                  style={[styles.tab, tab === item && styles.activeTab]}>
                  <Text style={[styles.tabText, tab === item && styles.activeTabText]}>
                    {item === 'login' ? 'Login' : 'Sign up'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={!googleConfigured || !googleRequest || submitting}
              onPress={handleGoogleSignIn}
              style={({ pressed }) => [styles.googleButton, pressed && styles.secondaryPressed, (!googleConfigured || submitting) && styles.buttonDisabled]}>
              <Text style={styles.googleMark}>G</Text>
              <Text style={styles.googleButtonText}>{tab === 'register' ? 'Sign up with Google' : 'Sign in with Google'}</Text>
            </Pressable>
            {!googleConfigured ? <Text style={styles.configHint}>Google sign-in needs the mobile client ID in .env.local.</Text> : null}

            <View style={styles.dividerRow}><View style={styles.divider} /><Text style={styles.dividerText}>OR</Text><View style={styles.divider} /></View>

            <View style={styles.card}>
              {tab === 'login' && loginStep === 'login' ? (
                <>
                  <Text style={styles.title}>Welcome back</Text>
                  <Text style={styles.subtitle}>Enter your email and password to continue.</Text>
                  <AuthNote
                    icon="lock-closed-outline"
                    title="Password login"
                    description="Use the password you created after verifying your email."
                  />
                  <AuthInput label="Email" value={email} onChangeText={setEmail} kind="email" placeholder="name@example.com" />
                  <PasswordInput label="Password" value={password} onChangeText={setPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} onSubmit={handleSignIn} />
                  <Pressable onPress={() => { setLoginStep('forgot'); clearFeedback(); }}><Text style={styles.linkRight}>Forgot password?</Text></Pressable>
                  <Feedback error={error} notice={notice} />
                  <PrimaryButton icon="log-in-outline" label="Login" loading={submitting} onPress={handleSignIn} />
                </>
              ) : null}

              {tab === 'login' && loginStep === 'forgot' ? (
                <>
                  <Text style={styles.title}>Reset password</Text>
                  <Text style={styles.subtitle}>Enter your registered email to receive an OTP.</Text>
                  <AuthNote
                    icon="mail-outline"
                    title="Reset by email"
                    description="We will send a 6-digit OTP to your registered email."
                  />
                  <AuthInput label="Email" value={email} onChangeText={setEmail} kind="email" placeholder="name@example.com" onSubmit={handleForgotPassword} />
                  <Feedback error={error} notice={notice} />
                  <PrimaryButton icon="mail-outline" label="Send Reset OTP" loading={submitting} onPress={handleForgotPassword} />
                  <SecondaryButton label="Back to Login" disabled={submitting} onPress={() => { setLoginStep('login'); clearFeedback(); }} />
                </>
              ) : null}

              {isPasswordReset ? (
                <>
                  <BackButton label="Edit email" onPress={() => { setLoginStep('forgot'); setOtp(''); setNewPassword(''); clearFeedback(); }} />
                  <Text style={styles.title}>Apply new password</Text>
                  <Text style={styles.subtitle}>Enter the 6-digit code sent to {resetEmail}.</Text>
                  <AuthNote
                    icon="shield-checkmark-outline"
                    title="OTP verified reset"
                    description="Enter the code from your email, then choose a fresh password."
                  />
                  <OtpInput value={otp} onChangeText={setOtp} />
                  <PasswordInput label="New password" value={newPassword} onChangeText={setNewPassword} visible={showNewPassword} onToggle={() => setShowNewPassword((value) => !value)} helper={passwordPolicy} onSubmit={handleResetPassword} />
                  <ResendRow seconds={resendTimer} disabled={submitting} onPress={handleResend} />
                  <Feedback error={error} notice={notice} />
                  <PrimaryButton icon="shield-checkmark-outline" label="Reset Password" loading={submitting} disabled={otp.length !== 6} onPress={handleResetPassword} />
                </>
              ) : null}

              {tab === 'register' && registerStep === 'details' ? (
                <>
                  <Text style={styles.title}>Create account</Text>
                  <Text style={styles.subtitle}>Verify your email, then use this password for login.</Text>
                  <AuthInput label="Full Name" value={name} onChangeText={setName} placeholder="John Doe" autoCapitalize="words" />
                  <AuthInput label="Email" value={email} onChangeText={setEmail} kind="email" placeholder="name@example.com" />
                  <PasswordInput label="Password" value={password} onChangeText={setPassword} visible={showPassword} onToggle={() => setShowPassword((value) => !value)} helper={passwordPolicy} onSubmit={handleRegister} />
                  <Feedback error={error} notice={notice} />
                  <PrimaryButton icon="person-add-outline" label="Send Verification OTP" loading={submitting} onPress={handleRegister} />
                </>
              ) : null}

              {isRegistrationVerification ? (
                <>
                  <BackButton label="Edit details" onPress={() => { setRegisterStep('details'); setOtp(''); clearFeedback(); }} />
                  <Text style={styles.title}>Verify email</Text>
                  <Text style={styles.subtitle}>Enter the 6-digit code sent to {registerEmail}</Text>
                  <OtpInput value={otp} onChangeText={setOtp} onSubmit={handleVerifyRegistration} />
                  <ResendRow seconds={resendTimer} disabled={submitting} onPress={handleResend} />
                  <Feedback error={error} notice={notice} />
                  <PrimaryButton icon="shield-checkmark-outline" label="Verify & Create Account" loading={submitting} disabled={otp.length !== 6} onPress={handleVerifyRegistration} />
                </>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type AuthInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  kind?: 'email';
  autoCapitalize?: 'none' | 'words';
  onSubmit?: () => void;
};

function AuthInput({ label, value, onChangeText, placeholder, kind, autoCapitalize, onSubmit }: AuthInputProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize || (kind === 'email' ? 'none' : 'sentences')}
        autoComplete={kind === 'email' ? 'email' : 'name'}
        keyboardType={kind === 'email' ? 'email-address' : 'default'}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        returnKeyType={onSubmit ? 'done' : 'next'}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function PasswordInput({ label, value, onChangeText, visible, onToggle, helper, onSubmit }: {
  label: string; value: string; onChangeText: (value: string) => void; visible: boolean; onToggle: () => void; helper?: string; onSubmit: () => void;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.passwordWrap}>
        <TextInput
          autoCapitalize="none"
          autoComplete={label === 'Password' ? 'current-password' : 'new-password'}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          placeholder={label}
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          secureTextEntry={!visible}
          style={[styles.input, styles.passwordInput]}
          value={value}
        />
        <Pressable accessibilityLabel={visible ? 'Hide password' : 'Show password'} hitSlop={10} onPress={onToggle} style={styles.eyeButton}>
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={21} color={colors.muted} />
        </Pressable>
      </View>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

function OtpInput({ value, onChangeText, onSubmit }: { value: string; onChangeText: (value: string) => void; onSubmit?: () => void }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>OTP code</Text>
      <TextInput
        autoComplete="one-time-code"
        keyboardType="number-pad"
        maxLength={6}
        onChangeText={(next) => onChangeText(next.replace(/\D/g, ''))}
        onSubmitEditing={onSubmit}
        placeholder="000000"
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.otpInput]}
        textContentType="oneTimeCode"
        value={value}
      />
    </View>
  );
}

type IoniconName = keyof typeof Ionicons.glyphMap;

function AuthNote({ icon, title, description }: { icon: IoniconName; title: string; description: string }) {
  return (
    <View style={styles.authNote}>
      <View style={styles.authNoteIcon}>
        <Ionicons name={icon} size={18} color="#34C759" />
      </View>
      <View style={styles.authNoteCopy}>
        <Text style={styles.authNoteTitle}>{title}</Text>
        <Text style={styles.authNoteDescription}>{description}</Text>
      </View>
    </View>
  );
}

function PrimaryButton({ icon, label, loading, disabled = false, onPress }: { icon?: IoniconName; label: string; loading: boolean; disabled?: boolean; onPress: () => void }) {
  const isDisabled = loading || disabled;
  return (
    <Pressable accessibilityRole="button" disabled={isDisabled} onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, isDisabled && styles.buttonDisabled]}>
      {loading ? <ActivityIndicator color={colors.surface} /> : (
        <View style={styles.buttonContent}>
          {icon ? <Ionicons name={icon} size={18} color={colors.surface} /> : null}
          <Text style={styles.buttonText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

function SecondaryButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryPressed, disabled && styles.buttonDisabled]}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.backButton}><Ionicons name="arrow-back" size={17} color={colors.primary} /><Text style={styles.link}>{label}</Text></Pressable>;
}

function ResendRow({ seconds, disabled, onPress }: { seconds: number; disabled: boolean; onPress: () => void }) {
  return (
    <View style={styles.resendRow}>
      <Text style={styles.helper}>Didn&apos;t receive the code?</Text>
      <Pressable disabled={seconds > 0 || disabled} onPress={onPress}>
        <Text style={[styles.link, (seconds > 0 || disabled) && styles.disabledLink]}>{seconds > 0 ? `Resend in ${seconds}s` : 'Resend OTP'}</Text>
      </Pressable>
    </View>
  );
}

function Feedback({ error, notice }: { error: string; notice: string }) {
  if (error) return <View style={[styles.feedback, styles.errorBox]}><Ionicons name="alert-circle-outline" size={18} color={colors.danger} /><Text style={styles.error}>{error}</Text></View>;
  if (notice) return <View style={[styles.feedback, styles.noticeBox]}><Ionicons name="checkmark-circle-outline" size={18} color={colors.success} /><Text style={styles.notice}>{notice}</Text></View>;
  return null;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFBFC' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.lg },
  brand: { alignItems: 'center' },
  brandIcon: { width: 48, height: 48, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, marginBottom: spacing.md, ...shadows.card },
  brandMark: { fontSize: 19, lineHeight: 24, fontWeight: '900', color: colors.surface },
  eyebrow: { ...typography.label, fontSize: 12, color: '#34C759', letterSpacing: 0.8 },
  brandTitle: { ...typography.display, fontSize: 32, lineHeight: 39, color: colors.text, marginTop: spacing.xxs },
  brandSubtitle: { ...typography.body, fontSize: 14, lineHeight: 21, color: colors.muted, marginTop: spacing.xs, textAlign: 'center', maxWidth: 360 },
  authShell: { width: '100%', maxWidth: 384, alignSelf: 'center', gap: spacing.md },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: radii.sm, backgroundColor: colors.primarySoft },
  tab: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radii.sm },
  activeTab: { backgroundColor: colors.primary },
  tabText: { ...typography.label, color: colors.muted },
  activeTabText: { color: colors.surface },
  googleButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, backgroundColor: colors.surface },
  googleMark: { fontSize: 20, lineHeight: 24, fontWeight: '800', color: '#4285F4' },
  googleButtonText: { ...typography.label, color: colors.text },
  secondaryPressed: { backgroundColor: colors.primarySoft },
  configHint: { ...typography.caption, color: colors.warning, textAlign: 'center', marginTop: -spacing.sm },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { ...typography.caption, color: '#94A3B8', fontWeight: '700', letterSpacing: 0.5 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md, gap: spacing.md, ...shadows.card },
  title: { ...typography.title, fontSize: 20, lineHeight: 26, color: colors.text },
  subtitle: { ...typography.body, color: colors.muted, marginTop: -spacing.sm },
  authNote: { flexDirection: 'row', gap: spacing.sm, borderWidth: 1, borderColor: '#EAFBF0', borderRadius: radii.sm, backgroundColor: '#EAFBF0', padding: spacing.sm },
  authNoteIcon: { width: 40, height: 40, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: radii.sm, backgroundColor: colors.surface },
  authNoteCopy: { flex: 1, justifyContent: 'center' },
  authNoteTitle: { ...typography.label, color: colors.text },
  authNoteDescription: { ...typography.caption, color: colors.muted, marginTop: 1 },
  fieldGroup: { gap: spacing.xs },
  label: { ...typography.label, color: colors.text },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, paddingHorizontal: spacing.md, color: colors.text, backgroundColor: colors.surface, fontSize: 15 },
  passwordWrap: { position: 'relative' },
  passwordInput: { paddingRight: 50 },
  eyeButton: { position: 'absolute', right: spacing.md, top: 11 },
  otpInput: { letterSpacing: 8, textAlign: 'center', fontWeight: '700' },
  helper: { ...typography.caption, color: colors.muted },
  link: { ...typography.label, color: '#34C759', textDecorationLine: 'underline' },
  linkRight: { ...typography.label, color: '#34C759', textAlign: 'right', textDecorationLine: 'underline', marginTop: -spacing.xs },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start' },
  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  disabledLink: { color: colors.muted },
  feedback: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radii.sm, padding: spacing.sm },
  errorBox: { backgroundColor: colors.dangerSoft },
  noticeBox: { backgroundColor: colors.successSoft },
  error: { ...typography.caption, color: colors.danger, flex: 1 },
  notice: { ...typography.caption, color: colors.success, flex: 1 },
  button: { minHeight: 44, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  buttonPressed: { backgroundColor: colors.primaryPressed },
  buttonDisabled: { opacity: 0.55 },
  buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  buttonText: { ...typography.label, color: colors.surface },
  secondaryButton: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  secondaryButtonText: { ...typography.label, color: colors.text },
});
