import { router } from 'expo-router';
import { useState } from 'react';
import { AppScreen } from '@/components/layout/app-screen';
import { AppButton } from '@/components/ui/app-button';
import { FormField } from '@/components/ui/form-field';
import { FormCard, Copy, ErrorNotice } from '@/features/operations/ui';
import { errorText } from '@/features/operations/api';
import { backend } from '@/lib/supabase';
import { signOut, useAuth } from '@/state/auth';
export default function Recovery() {
  const auth = useAuth(); const [password,setPassword]=useState(''); const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null);
  return <AppScreen hideSettings title="Account recovery"><FormCard>
    {!auth.session ? <><Copy>Open the latest verification or recovery link on the device where it was requested. Keep this screen open while the link is verified.</Copy><ErrorNotice message={auth.error} /><AppButton label="Back to sign in" onPress={() => router.replace('/(auth)/sign-in')} /></> : <>
      <Copy>Your account is authenticated. Set a new password if you requested recovery.</Copy>
      <FormField label="New password" secureTextEntry value={password} onChangeText={setPassword} /><FormField label="Confirm password" secureTextEntry value={confirm} onChangeText={setConfirm} />
      <ErrorNotice message={error} /><AppButton disabled={busy} label="Update password" onPress={() => { void (async () => { setBusy(true); setError(null); try { if(password.length<8 || password!==confirm) throw new Error('Use at least eight characters and matching passwords.'); const result=await backend().auth.updateUser({password}); if(result.error) throw result.error; await signOut(); auth.clearRecovery(); } catch(failure){setError(errorText(failure));} finally{setBusy(false);} })(); }} />
      {!auth.recovering ? <AppButton disabled={busy} variant="secondary" label="Continue to business" onPress={() => router.replace('/(owner)/(tabs)/dashboard')} /> : null}
    </>}
  </FormCard></AppScreen>;
}
