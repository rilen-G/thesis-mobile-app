import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { colors, fonts, spacing, textStyles } from '@/theme/tokens';

export default function SignInScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [role, setRole] = useState('Owner/Admin'); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const signup = mode === 'signup';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.intro}><Text style={styles.eyebrow}>Partner Business</Text><Text style={styles.title}>{signup ? 'Create staff access' : 'Welcome back'}</Text></View>
          <Card style={styles.card}>
            {signup ? <FormField autoComplete="name" label="Staff name" onChangeText={setName} placeholder="Juan Dela Cruz" value={name} /> : null}
            <FormField autoCapitalize="none" autoComplete="email" inputMode="email" label="Email or phone" onChangeText={setEmail} placeholder="owner@qfacio.test" value={email} />
            {signup ? <FormField autoComplete="organization-title" label="Business role" onChangeText={setRole} placeholder="Owner/Admin" value={role} /> : null}
            <FormField autoCapitalize="none" autoComplete={signup ? 'new-password' : 'current-password'} label="Password" onChangeText={setPassword} placeholder="Enter any sample password" secureTextEntry value={password} />
            {signup ? <FormField autoCapitalize="none" autoComplete="new-password" label="Confirm password" onChangeText={setConfirm} placeholder="Repeat sample password" secureTextEntry value={confirm} /> : null}
            <AppButton label={signup ? 'Create Account' : 'Sign In'} onPress={() => router.replace('/(owner)/(tabs)/dashboard')} />
            <View style={styles.divider} />
            <Text style={styles.switchCopy}>{signup ? 'Already have access?' : 'Need an account for this wireframe?'}</Text>
            <AppButton compact label={signup ? 'Back to Login' : 'Go to Sign Up'} onPress={() => setMode(signup ? 'login' : 'signup')} variant="secondary" />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.cream, flex: 1 }, flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl }, intro: { marginBottom: spacing.xxl },
  eyebrow: { ...textStyles.body, fontFamily: fonts.extraBold }, title: { ...textStyles.headline, color: colors.terracotta, fontSize: 24, lineHeight: 32 },
  card: { gap: spacing.lg }, divider: { backgroundColor: colors.line, height: 1 },
  switchCopy: { ...textStyles.body, textAlign: 'center' },
});
