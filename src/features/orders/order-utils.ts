import type { Order, OrderStatus } from '@/types';

export type OrderAction = { label: string; nextStatus: OrderStatus; variant: 'primary' | 'secondary'; disabled?: boolean };

export function getStatusLabel(status: OrderStatus) {
  return status;
}

export function getOrderBlockReason(order: Order) {
  if (order.status !== 'Confirmed') return null;
  if (order.allocationIssue) return order.allocationIssue;
  if (order.aiPaused) return 'AI is paused for this conversation. Review the order before accepting.';
  return null;
}

export function getOrderActions(order: Order): OrderAction[] {
  if (order.status === 'Confirmed') {
    return [
      { label: 'Reject', nextStatus: 'Rejected', variant: 'secondary' },
      { label: 'Accept', nextStatus: 'Accepted', variant: 'primary', disabled: Boolean(order.allocationIssue || order.aiPaused) },
    ];
  }
  if (order.status === 'Accepted') return [{ label: 'Ready', nextStatus: 'Ready', variant: 'primary' }];
  if (order.status === 'Ready') return [{ label: 'Received', nextStatus: 'Completed', variant: 'primary' }];
  return [];
}

export function elapsedRank(elapsed: string) {
  const lower = elapsed.toLowerCase();
  const amount = Number.parseInt(lower, 10);
  if (lower.includes('min')) return Number.isNaN(amount) ? 0 : amount;
  if (lower.includes('hr')) return Number.isNaN(amount) ? 60 : amount * 60;
  if (lower.includes('yesterday')) return 1440;
  return Number.MAX_SAFE_INTEGER;
}
