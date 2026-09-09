import type { PermissionExample } from '@/types';

export const permissionExamples: PermissionExample[] = [
  { action: 'Full Messenger Conversation', owner: 'Full access', defaultStaff: 'No', authorizedStaff: 'Enable for trusted staff who handle customer concerns.' },
  { action: 'Edit Menu and Photos', owner: 'Full access', defaultStaff: 'No', authorizedStaff: 'Enable when staff may update menu records and food photos.' },
  { action: 'Approve Promo Drafts', owner: 'Full access', defaultStaff: 'No', authorizedStaff: 'Enable only for staff allowed to approve promotional posts.' },
];
