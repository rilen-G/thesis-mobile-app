import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppButton } from '@/components/ui/app-button';
import { FormField } from '@/components/ui/form-field';
import { Copy, DataScreen, ErrorNotice, FormCard } from '@/features/operations/ui';
import { errorText } from '@/features/operations/api';
import { useOperations } from '@/state/operations';
import { textStyles } from '@/theme/tokens';
import { messengerCommand, pendingMessenger, readConnection, readConversations, readMessages,
  type Connection, type Conversation, type Message } from './api';
import { inboxError } from './errors';
import type { Command } from '@/features/operations/domain';

export default function MessengerInbox() {
  const { data } = useOperations();
  return <DataScreen title="Messenger inbox" ownerOnly detail>
    {data?.role === 'owner' ? <Inbox key={data.business.id} businessId={data.business.id} /> : null}
  </DataScreen>;
}
function Inbox({ businessId }: { businessId: string }) {
  const [loaded, setLoaded] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<string>();
  const [limit, setLimit] = useState(30);
  const [moreMessages, setMoreMessages] = useState(false);
  const [reply, setReply] = useState(''); const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const mounted = useRef(true); const sequence = useRef(0); const working = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const [conn, list, p, latest] = await Promise.all([readConnection(businessId), readConversations(businessId, limit),
        pendingMessenger(), selected ? readMessages(businessId, selected) : Promise.resolve([])]);
      if (!mounted.current || request !== sequence.current) return;
      setLoaded(true); setConnection(conn); setConversations(list); setPending(Boolean(p));
      setNow(Date.now());
      setMessages(previous => {
        const merged = new Map(previous.map(m => [m.id, m]));
        latest.forEach(m => merged.set(m.id, m)); return [...merged.values()].sort((a, b) => a.seq - b.seq);
      });
      setMoreMessages(latest.length === 50); setError(null);
    } catch (failure) { if (mounted.current && request === sequence.current) setError(inboxError(failure)); }
    finally { if (mounted.current && request === sequence.current) setLoading(false); }
  }, [businessId, limit, selected]);
  useFocusEffect(useCallback(() => {
    let active = true; let fetching = false;
    const refresh = async () => { if (!active || fetching || AppState.currentState === 'background') return; fetching = true; try { await load(); } finally { fetching = false; } };
    void refresh(); const interval = setInterval(() => { void refresh(); }, 5000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { active = false; clearInterval(interval); subscription.remove(); sequence.current++; };
  }, [load]));
  async function run(payload?: Command) {
    if (working.current) return; working.current = true; setBusy(true); setError(null);
    try { await messengerCommand(payload ? { ...payload, business_id: businessId } : undefined); if (payload?.op === 'reply') setReply(''); await load(); }
    catch (failure) { setPending(Boolean(await pendingMessenger().catch(() => null))); setError(errorText(failure)); }
    finally { working.current = false; if (mounted.current) setBusy(false); }
  }
  const current = conversations.find(c => c.id === selected);
  const disabled = busy || pending;
  const windowOpen = current && Date.parse(current.last_customer_at) > now - 86400000;
  const action = (op: string, extra: Record<string, unknown> = {}) => void run({ op, conversation_id: current?.id, version: current?.version, ...extra });
  async function older() {
    if (!selected || !messages.length) return;
    try { const page = await readMessages(businessId, selected, messages[0].seq);
      setMessages(old => [...new Map([...page, ...old].map(m => [m.id, m])).values()].sort((a, b) => a.seq - b.seq)); setMoreMessages(page.length === 50);
    } catch (failure) { setError(errorText(failure)); }
  }
  return <>
    {loading ? <ActivityIndicator accessibilityLabel="Loading Messenger" /> : null}
    <ErrorNotice message={error} />
    <AppButton label="Refresh inbox" variant="secondary" onPress={() => { void load(); }} />
    {pending ? <FormCard><Copy>A Messenger save has an uncertain result. Retry it before another action.</Copy>
      <AppButton label="Retry pending Messenger save" disabled={busy} onPress={() => { void run(); }} /></FormCard> : null}
    {loaded ? <FormCard><Text style={textStyles.title}>Facebook connection</Text>
      {connection ? <>
        <Copy>{connection.page_name} · {connection.verified_at ? connection.enabled ? 'Enabled' : 'Paused' : 'Configured — test required'}</Copy>
        <Copy>Last incoming: {connection.last_inbound_at ? new Date(connection.last_inbound_at).toLocaleString() : 'None yet'}</Copy>
        <Copy>Last provider acceptance: {connection.last_accepted_at ? new Date(connection.last_accepted_at).toLocaleString() : 'None yet'}</Copy>
        {(!connection.worker_seen_at || Date.parse(connection.worker_seen_at) < now - 180000) ? <Copy>Worker has not checked in recently. Check the recovery schedule.</Copy> : null}
        {!connection.verified_at ? <><Copy>Send a message from the configured tester account. After receiving the test reply in Messenger, confirm below.</Copy>
          <AppButton label="I received the test reply" disabled={disabled || !connection.last_accepted_at} onPress={() => { void run({ op: 'verify' }); }} /></> :
          <AppButton label={connection.enabled ? 'Pause Messenger automation' : 'Enable Messenger automation'} disabled={disabled} onPress={() => { void run({ op: 'enabled', enabled: !connection.enabled, version: connection.version }); }} />}
        <Copy>Pausing stops queued actions. A send already authorized may still complete.</Copy>
      </> : <Copy>Messenger is not configured in the backend yet. Complete the Zapier setup guide to connect this business.</Copy>}
    </FormCard> : null}
    {!selected ? <>
      {conversations.map(c => <AppButton key={c.id} variant="secondary" label={`Customer …${c.sender_id.slice(-4)}${c.needs_attention ? ' · Needs owner attention' : ''}${c.takeover ? ' · Owner handling' : ''}`}
        onPress={() => { sequence.current++; setMessages([]); setReply(''); setNote(''); setSelected(c.id); }} />)}
      {!conversations.length && loaded && !error ? <Copy>No live conversations yet.</Copy> : null}
      {conversations.length === limit ? <AppButton label="Load more conversations" variant="secondary" onPress={() => setLimit(n => n + 30)} /> : null}
    </> : <>
      <AppButton label="Back to conversations" variant="secondary" onPress={() => { sequence.current++; setSelected(undefined); setMessages([]); }} />
      {current ? <>
        <FormCard><Copy>{current.takeover ? 'Owner handling — AI paused' : 'AI assistance enabled'}{current.needs_attention ? ' · Needs owner attention' : ''}</Copy>
          <Copy>{windowOpen ? 'Messaging window is open.' : 'Messaging window has expired. Wait for a new customer message.'}</Copy>
          <AppButton label={current.takeover ? 'Resume AI' : 'Take over conversation'} disabled={disabled} onPress={() => action('takeover', { takeover: !current.takeover })} />
          {current.order_id ? <AppButton label="Open linked order" variant="secondary" onPress={() => router.push({ pathname: '/(owner)/order/[id]', params: { id: current.order_id! } })} /> : null}
        </FormCard>
        {moreMessages ? <AppButton label="Load older messages" variant="secondary" onPress={() => { void older(); }} /> : null}
        {messages.map(m => <FormCard key={m.id}><Text style={textStyles.label}>{m.role === 'customer' ? 'Customer' : m.role === 'owner' ? 'Owner' : 'Assistant'}</Text>
          <Copy>{m.body}</Copy><Copy>{new Date(m.created_at).toLocaleString()} · {m.state === 'accepted' ? 'Accepted by provider (delivery not confirmed)' : m.state}</Copy>
          {m.error_code ? <Copy>{m.error_code.replaceAll('_', ' ')}</Copy> : null}
          {m.state === 'failed' && (m.role === 'customer' || m.error_code === 'handoff_exhausted') ? <AppButton label={m.role === 'customer' ? 'Retry AI processing' : 'Retry Zapier handoff'} disabled={disabled} onPress={() => action('retry', { message_id: m.id })} /> : null}
          {m.state === 'unknown' ? <>
            <Copy>Check the actual Messenger conversation and Zap history before recording an outcome. This does not resend the message.</Copy>
            <FormField label="Reconciliation evidence" value={note} onChangeText={setNote} maxLength={500} />
            <AppButton label="Confirmed sent" disabled={disabled || note.trim().length < 5} onPress={() => action('reconcile', { message_id: m.id, outcome: 'accepted', note })} />
            <AppButton label="Confirmed not sent" variant="secondary" disabled={disabled || note.trim().length < 5} onPress={() => action('reconcile', { message_id: m.id, outcome: 'not_sent', note })} />
          </> : null}
        </FormCard>)}
        {current.takeover ? <FormCard><FormField label="Reply to customer" value={reply} onChangeText={setReply} multiline maxLength={3900} />
          <AppButton label="Send reply" disabled={disabled || !windowOpen || !connection?.enabled || !reply.trim()} onPress={() => action('reply', { body: reply.trim() })} /></FormCard> : null}
      </> : <Copy>Conversation moved outside this page. Return to the list and load more conversations.</Copy>}
    </>}
  </>;
}
