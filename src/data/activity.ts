import type { ActivityEntry } from '@/types';

export const activityGroups: { day: string; entries: ActivityEntry[] }[] = [
  {
    day: 'Today',
    entries: [
      { id: 'ai-paused', time: '11:21 AM', title: 'AI paused for Messenger conversation', detail: 'Manual handling enabled for Maria Santos because allocation needed review.', status: 'Paused', icon: 'pause', tone: 'system' },
      { id: 'dessert-pause', time: '11:20 AM', title: 'Leche Flan marked temporarily unavailable', detail: 'Kitchen paused Messenger availability for the dessert item. Pending orders and promotions for the item now require review.', status: 'System', icon: 'package', tone: 'system' },
      { id: 'ord-906', time: '10:31 AM', title: 'Order #ORD-906 accepted', detail: 'Action performed by Ana Santos. Online allocation was deducted only after staff acceptance.', status: 'Accepted', icon: 'check', tone: 'accepted' },
      { id: 'promo-041', time: '10:05 AM', title: 'Promotional draft queued for approval', detail: 'PROMO-041 passed photo and allocation checks and is waiting for the first authorized approval.', status: 'For Approval', icon: 'lock', tone: 'updated' },
      { id: 'failed-publish', time: '09:12 AM', title: 'Facebook publication failed', detail: 'PROMO-045 was marked Failed to Publish. Authorized retry is available after checking the connection.', status: 'Failed', icon: 'retry', tone: 'warning' },
    ],
  },
  {
    day: 'Yesterday',
    entries: [
      { id: 'ai-follow-up', time: '04:30 PM', title: 'Recent transactional follow-up sent', detail: 'One predefined follow-up was sent for an unconfirmed draft inside the Messenger window.', status: 'Auto-Sent', icon: 'bot', tone: 'sent', message: '“Hi! Confirm nyo po ba yung order summary, or may gusto kayong baguhin?”' },
      { id: 'marketing-opt-in', time: '03:05 PM', title: 'Follow-up window checked', detail: 'The customer was not eligible for another automatic follow-up because one normal follow-up had already been sent.', status: 'Checked', icon: 'bot', tone: 'sent' },
      { id: 'allocation-refresh', time: '02:05 PM', title: 'Pork Adobo allocation adjusted', detail: 'Online capacity changed from 5 to 7 orders. This is capacity control, not inventory tracking.', status: 'Updated', icon: 'edit', tone: 'updated' },
      { id: 'staff-access', time: '01:10 PM', title: 'Staff permission changed', detail: 'Owner granted promo draft edit access to Ana Santos without granting publish approval.', status: 'Permission', icon: 'shield', tone: 'updated' },
      { id: 'pastil-price', time: '09:15 AM', title: 'Price updated for Chicken Pastil', detail: 'Updated from ₱85 to ₱95 by Admin. Menu record edits are owner-only unless optional access is granted.', status: 'Updated', icon: 'menu', tone: 'updated' },
    ],
  },
];
