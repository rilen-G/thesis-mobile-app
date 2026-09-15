import type { Command } from './domain';
export type PendingOperation = { payload: Command; requestId: string };
export type JournalStorage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>; removeItem: (key: string) => Promise<void> };
/** A recovery journal, not an offline send queue. Retrying always requires a user action. */
export function pendingJournal(storage: JournalStorage, userId: string) {
  const key = `operations.pending.${userId}`;
  return {
    async read(): Promise<PendingOperation | null> { const value = await storage.getItem(key); return value ? JSON.parse(value) as PendingOperation : null; },
    async prepare(operation: PendingOperation): Promise<PendingOperation> {
      const current = await this.read();
      if (current && JSON.stringify(current.payload) !== JSON.stringify(operation.payload)) throw new Error('A previous save has an uncertain result. Use “Retry pending save” before submitting another change.');
      if (current) return current;
      await storage.setItem(key, JSON.stringify(operation));
      return operation;
    },
    async clear() { await storage.removeItem(key); },
  };
}
