import { Redirect } from 'expo-router';
import * as Linking from 'expo-linking';
import { LockKeyhole, Mail } from 'lucide-react-native';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { Copy, ErrorNotice } from '@/features/operations/ui';
import { errorText } from '@/features/operations/api';
import { backend, backendConfigured } from '@/lib/supabase';
import { useAuth } from '@/state/auth';
import { colors, fonts, spacing, textStyles } from '@/theme/tokens';

export default function SignInScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState('');
  if (auth.loading) return <SafeAreaView style={styles.safe}><ActivityIndicator /></SafeAreaView>;
  if (auth.recovering && auth.session) return <Redirect href="/(auth)/recovery" />;
  if (auth.session) return <Redirect href="/(owner)/(tabs)/dashboard" />;
  async function submit() {
    setError(null); setNotice(''); setBusy(true);
    try {
      if (!email.trim()) throw new Error('Enter your email.');
      if (mode === 'signup' && (password.length < 8 || password !== confirm)) throw new Error('Use at least eight characters and matching passwords.');
      const client = backend();
      const redirect = Linking.createURL('/recovery');
      const result = mode === 'login' ? await client.auth.signInWithPassword({ email: email.trim(), password })
        : mode === 'signup' ? await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirect } })
        : await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect });
      if (result.error) throw result.error;
      if (mode !== 'login') setNotice(mode === 'signup' ? 'Check your email to verify your account on this device. Staff should then ask the owner to add their verified email.' : 'If the account exists, a recovery link will arrive by email. Open it on this device.');
    } catch (failure) { setError(errorText(failure)); } finally { setBusy(false); }
  }
  const title = mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create staff access' : 'Recover account';
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={styles.heading}><Text style={styles.eyebrow}>Partner Business</Text><Text style={styles.title}>{title}</Text></View>
    <Card style={styles.card}>
      {!backendConfigured ? <View style={styles.notice}><Copy>Backend setup required. Configure the Supabase URL and publishable key, then restart the app.</Copy></View> : null}
      <AuthField icon={<Mail color={colors.terracotta} size={18} />} label="Email" autoCapitalize="none" autoComplete="email" inputMode="email" value={email} onChangeText={setEmail} placeholder="owner@qfacio.test" />
      {mode !== 'reset' ? <AuthField icon={<LockKeyhole color={colors.terracotta} size={18} />} label="Password" autoCapitalize="none" secureTextEntry value={password} onChangeText={setPassword} placeholder="Enter your password" /> : null}
      {mode === 'signup' ? <AuthField icon={<LockKeyhole color={colors.terracotta} size={18} />} label="Confirm password" secureTextEntry value={confirm} onChangeText={setConfirm} placeholder="Repeat your password" /> : null}
      <ErrorNotice message={error ?? auth.error} />{notice ? <Copy>{notice}</Copy> : null}
      <AppButton disabled={busy || !backendConfigured} label={busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Recovery Link'} onPress={() => { void submit(); }} />
      <View style={styles.divider} />
      {mode === 'login' ? <><Text style={styles.helper}>Need an account?</Text><AppButton disabled={busy} variant="ghost" label="Go to Sign Up" onPress={() => { setMode('signup'); setError(null); setNotice(''); }} /><AppButton compact disabled={busy} variant="secondary" label="Forgot password" onPress={() => { setMode('reset'); setError(null); setNotice(''); }} /></> : <><Text style={styles.helper}>{mode === 'signup' ? 'Already have access?' : 'Remembered your password?'}</Text><AppButton disabled={busy} variant="ghost" label="Back to Login" onPress={() => { setMode('login'); setError(null); setNotice(''); }} /></>}
    </Card>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

function AuthField({ icon, label, ...props }: ComponentProps<typeof TextInput> & { icon: ReactNode; label: string }) {
  return <View style={{ gap: 8 }}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.inputWrap}>{icon}<TextInput placeholderTextColor={colors.subtleText} style={styles.input} {...props} /></View></View>;
}

const styles = StyleSheet.create({
  safe: { alignSelf: 'center', backgroundColor: colors.cream, flex: 1, maxWidth: 430, width: '100%' }, flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, paddingBottom: 28 }, heading: { marginBottom: 28 },
  eyebrow: { color: colors.muted, fontFamily: fonts.extraBold, fontSize: 13 }, title: { ...textStyles.headline, color: colors.terracotta, fontSize: 22 },
  card: { borderWidth: 0, gap: 16 }, notice: { backgroundColor: colors.amberSoft, borderRadius: 8, padding: 10 }, fieldLabel: { ...textStyles.label },
  inputWrap: { alignItems: 'center', backgroundColor: colors.cream, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 8, height: 48, paddingHorizontal: 12 },
  input: { color: colors.ink, flex: 1, fontFamily: fonts.semiBold, fontSize: 16 }, divider: { backgroundColor: colors.line, height: 1, marginTop: 4 }, helper: { ...textStyles.body, textAlign: 'center' },
});
