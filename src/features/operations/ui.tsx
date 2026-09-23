import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { CheckCircle2 } from 'lucide-react-native';
import { AppButton } from '@/components/ui/app-button';
import { AppScreen } from '@/components/layout/app-screen';
import { Card } from '@/components/ui/card';
import { colors, spacing, textStyles } from '@/theme/tokens';
import { command, errorText, photoUrl } from './api';
import type { Command } from './domain';
import { useOperations } from '@/state/operations';

export function Copy({ children }: { children: ReactNode }) { return <Text style={textStyles.body}>{children}</Text>; }
export function ErrorNotice({ message }: { message: string | null }) { return message ? <Text accessibilityRole="alert" style={[textStyles.body, { color: colors.terracotta }]}>{message}</Text> : null; }
export function FormCard({ children }: { children: ReactNode }) { return <Card style={{ gap: spacing.md }}>{children}</Card>; }
export function useMutation() {
  const { refresh, refreshPending, setNotice } = useOperations();
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState(false);
  const locked = useRef(false);
  async function run(payload: Command, done?: (id: string) => void) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null); setSuccess(false); setNotice(null);
    try {
      const result = await command(payload, Crypto.randomUUID());
      setSuccess(true); await refresh(); setNotice('Changes saved.'); done?.(result.id);
    } catch (failure) {
      setError(errorText(failure));
    } finally { await refreshPending(); locked.current = false; setBusy(false); }
  }
  return { run, busy, error, success };
}
export function DataScreen({ title, children, ownerOnly = false, detail = false }: { title?: string; children: ReactNode; ownerOnly?: boolean; detail?: boolean }) {
  const { data, loading, error, refresh, notice } = useOperations();
  return <AppScreen title={title ?? data?.business.name ?? 'Partner Business'} detail={detail}>
    {loading ? <ActivityIndicator accessibilityLabel="Refreshing business data" /> : null}
    <ErrorNotice message={error} />
    {notice ? <SuccessNotice message={notice} /> : null}
    {error ? <AppButton compact label="Retry" variant="secondary" disabled={loading} onPress={() => { void refresh(); }} /> : null}
    <PendingSave />
    {data ? ownerOnly && data.role !== 'owner' ? <Copy>Only the business owner can access this screen.</Copy> : children : !loading && !error ? <Copy>Create your business to get started.</Copy> : null}
  </AppScreen>;
}
export function SuccessNotice({ message }: { message: string }) {
  return <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ alignItems: 'center', backgroundColor: colors.readySoft, borderColor: colors.ready, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.md }}>
    <CheckCircle2 color={colors.ready} size={20} />
    <Text style={[textStyles.body, { color: colors.ready, flex: 1 }]}>{message}</Text>
  </View>;
}
export function PendingSave() {
  const { pending, refresh, refreshPending } = useOperations();
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  if (!pending) return null;
  return <FormCard><Copy>A previous save may have completed. Retry it with the same request ID before making another change. Nothing is sent automatically.</Copy><ErrorNotice message={error} />
    <AppButton label="Retry pending save" disabled={busy} onPress={() => { void (async () => { setBusy(true); setError(null); try { await command(pending.payload, pending.requestId); await refresh(); } catch (failure) { setError(errorText(failure)); } finally { await refreshPending(); setBusy(false); } })(); }} />
  </FormCard>;
}
export function ProductPhoto({ path, height = 180 }: { path: string | null; height?: number }) {
  const [result, setResult] = useState<{ path: string; url?: string; error?: string; signedAt?: number }>(); const [retry, setRetry] = useState(0);
  const url = result?.path === path ? result.url : undefined;
  const error = result?.path === path ? result.error : undefined;
  useEffect(() => {
    let active = true;
    const load = () => { if (path) void photoUrl(path).then((value) => { if (active) setResult({ path, url: value, signedAt: Date.now() }); }).catch((failure) => { if (active) setResult({ path, error: errorText(failure) }); }); };
    // Keep the signed image URL stable while this photo is mounted.
    load();
    return () => { active = false; };
  }, [path, retry]);
  const handleImageError = () => {
    if (!path) return;
    if (result?.path === path && result.signedAt && Date.now() - result.signedAt >= 240000) {
      setResult(undefined);
      setRetry((n) => n + 1);
      return;
    }
    setResult({ path, error: 'Could not load the photo. Retry when connected.' });
  };
  if (!path) return <View style={{ height, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.menuSoft }}><Text style={[textStyles.tiny, { textAlign: 'center' }]}>No photo yet</Text></View>;
  return <View style={{ minHeight: height, justifyContent: 'center' }}>{url ? <Image accessibilityLabel="Product photo" source={{ uri: url }} style={{ width: '100%', height, borderRadius: 0 }} onError={handleImageError} /> : !error ? <ActivityIndicator /> : null}<ErrorNotice message={error ?? null} />{error ? <AppButton label="Retry photo" variant="secondary" onPress={() => {setResult(undefined); setRetry((n) => n + 1);}} /> : null}</View>;
}
