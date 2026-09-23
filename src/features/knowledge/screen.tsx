import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Switch } from 'react-native';
import * as Crypto from 'expo-crypto';
import { AppButton } from '@/components/ui/app-button';
import { FormField } from '@/components/ui/form-field';
import { Copy, DataScreen, ErrorNotice, FormCard } from '@/features/operations/ui';
import { errorText } from '@/features/operations/api';
import { useOperations } from '@/state/operations';
import { knowledgeCommand, pendingKnowledge, readKnowledge, type Knowledge } from './api';
import type { Command } from '@/features/operations/domain';

export default function ApprovedKnowledge() {
 const { data } = useOperations();
 return <DataScreen title="Approved knowledge" ownerOnly detail>
  {data?.role === 'owner' ? <Workspace key={data.business.id} bid={data.business.id} /> : null}
 </DataScreen>;
}
function Workspace({ bid }: { bid: string }) {
 const [items, setItems] = useState<Knowledge[]>();
 const [error, setError] = useState<string | null>(null);
 const [busy, setBusy] = useState(false); const [pending, setPending] = useState(false);
 const lock = useRef(false); const mounted = useRef(true);
 const load = useCallback(async () => {
  const [snapshot, operation] = await Promise.all([readKnowledge(bid), pendingKnowledge()]);
  if (mounted.current) { setItems(snapshot); setPending(Boolean(operation)); }
 }, [bid]);
 useEffect(() => {
  mounted.current = true;
  void load().catch(e => { if (mounted.current) setError(errorText(e)); });
  return () => { mounted.current = false; };
 }, [load]);
 async function run(work: () => Promise<unknown>) {
  if (lock.current) return; lock.current = true; setBusy(true); setError(null);
  try { await work(); await load(); }
  catch (e) {
   const operation = await pendingKnowledge().catch(() => null);
   if (mounted.current) { setError(errorText(e)); setPending(Boolean(operation)); }
  } finally { lock.current = false; if (mounted.current) setBusy(false); }
 }
 const save = (payload: Command) => run(() => knowledgeCommand({ ...payload, business_id: bid }));
 return <>
  <Copy>Approved FAQs and policies are used for live Messenger replies. Maintain opening hours in Settings. Withdraw approval to stop using an entry.</Copy>
  <ErrorNotice message={error} />
  {busy || (!items && !error) ? <ActivityIndicator accessibilityLabel="Loading knowledge" /> : null}
  <AppButton label="Refresh knowledge" variant="secondary" disabled={busy} onPress={() => { void run(load); }} />
  {pending ? <FormCard><Copy>A knowledge save has an uncertain result. Retry before making another change.</Copy>
   <AppButton label="Retry pending knowledge save" disabled={busy} onPress={() => { void run(() => knowledgeCommand()); }} /></FormCard> : null}
  {items ? <>
   <Editor key={`new-${items.length}`} busy={busy || pending} onSave={save} />
   {!items.length ? <Copy>No approved knowledge entries yet.</Copy> : null}
   {items.map(item => <Editor key={`${item.id}-${item.version}`} item={item} busy={busy || pending} onSave={save} />)}
  </> : null}
 </>;
}
function Editor({ item, busy, onSave }: { item?: Knowledge; busy: boolean; onSave: (payload: Command) => Promise<void> }) {
 const [id] = useState(item?.id ?? Crypto.randomUUID());
 const [title, setTitle] = useState(item?.title ?? ''); const [body, setBody] = useState(item?.body ?? '');
 const [approved, setApproved] = useState(item?.approved ?? false);
 return <FormCard><Copy>{item ? `Knowledge v${item.version}` : 'New FAQ / policy'}</Copy>
  <FormField label="Title" value={title} maxLength={120} onChangeText={setTitle} />
  <FormField label="Answer / policy" multiline value={body} maxLength={3000} onChangeText={setBody} />
  <Copy>Approved for AI retrieval</Copy><Switch accessibilityLabel="Approved for AI retrieval" value={approved} onValueChange={setApproved} />
  <AppButton label="Save knowledge" disabled={busy || !title.trim() || !body.trim()} onPress={() => { void onSave({ op: 'knowledge', id, version: item?.version ?? 0, title, body, approved }); }} />
 </FormCard>;
}
