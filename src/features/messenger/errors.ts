import { errorText } from '@/features/operations/api';
export function inboxError(failure: unknown) {
 const code = failure && typeof failure === 'object' && 'code' in failure ? failure.code : null;
 if (code === 'PGRST205' || code === '42P01') return 'Messenger backend setup is incomplete. Apply the Messenger database migration to this Supabase project, then refresh the inbox.';
 return errorText(failure);
}
