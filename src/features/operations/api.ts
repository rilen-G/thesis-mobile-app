import { Buffer } from 'buffer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
import { backend } from '@/lib/supabase';
import type { Command, Snapshot } from './domain';
import { pendingJournal } from './pending';

export function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : 'The request failed. Check your connection and retry.';
  const known: Record<string, string> = {
    permission_denied: 'Your account does not have permission for this action.', conflict: 'This record changed. Reload it before saving again.',
    draft_changed: 'The menu or conversation changed after this summary. Send a new test message to get an updated summary before confirming.',
    insufficient_quantity: 'There is not enough daily quantity. Refresh the menu and adjust this order.',
    rules_required: 'The owner must record the business order rules in Settings before confirming orders.',
    invalid_transition: 'This order cannot move to that status.', pickup_closed: 'Pickup must be today, in the future, within the approved business hours.',
    request_conflict: 'This retry differs from the original request. Reload before submitting a different action.',
  };
  return known[message] ?? (/fetch|network|timeout/i.test(message) ? 'Connection unavailable. Your inputs are preserved. Check your connection and retry.' : message);
}
export async function readPending(userId: string) { return pendingJournal(AsyncStorage, userId).read(); }
let writing = false;
export async function command(payload: Command, requestId: string): Promise<{ id: string }> {
  if (writing) throw new Error('Another save is in progress. Please wait.');
  writing = true;
  try {
    const { data: auth, error: authError } = await backend().auth.getSession();
    if (authError) throw authError;
    if (!auth.session) throw new Error('Sign in before saving.');
    const journal = pendingJournal(AsyncStorage, auth.session.user.id);
    const operation = await journal.prepare({ payload, requestId });
    const { data, error } = await backend().rpc('app_command', { payload: { ...operation.payload, request_id: operation.requestId } });
    if (error) {
      // SQL/PostgREST errors are definitive rejections; transport failures may have committed.
      if (/^([0-9A-Z]{5}|PGRST\d+)$/.test(error.code ?? '')) await journal.clear();
      throw error;
    }
    if (!data || typeof data.id !== 'string') throw new Error('The server returned an invalid operation result.');
    await journal.clear();
    return data;
  } finally { writing = false; }
}
export async function snapshot(): Promise<Snapshot | null> {
  const { data, error } = await backend().rpc('app_snapshot');
  if (error) throw error;
  if (data === null) return null;
  if (!data?.business?.id || !['owner', 'staff'].includes(data.role) || !['members', 'products', 'allocations', 'customers', 'orders', 'items', 'events'].every((key) => Array.isArray(data[key]))) throw new Error('The server returned invalid business data. Apply the current migrations.');
  return data as Snapshot;
}
export async function uploadPhoto(businessId: string, productId: string, asset: ImagePickerAsset) {
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > 600) context.resize(asset.width >= asset.height ? { width: 600 } : { height: 600 });
  const image = await (await context.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!image.base64) throw new Error('Could not read this photo. Select it again.');
  const bytes = Buffer.from(image.base64, 'base64');
  if (bytes.length > 5 * 1024 * 1024) throw new Error('Choose a photo smaller than 5 MB.');
  const path = `${businessId}/${productId}/${Crypto.randomUUID()}.jpeg`;
  const { error } = await backend().storage.from('product-photos').upload(path, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}
export async function photoUrl(path: string) {
  const { data, error } = await backend().storage.from('product-photos').createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}
