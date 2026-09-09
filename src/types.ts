import type { ImageSourcePropType } from 'react-native';

export type OrderStatus =
  | 'Customer-Confirmed / Awaiting Staff Acceptance'
  | 'Rejected'
  | 'Accepted'
  | 'Preparing'
  | 'Ready'
  | 'Completed'
  | 'Cancelled'
  | 'Expired';

export type ChatClassification =
  | 'Inquiry'
  | 'Incomplete Order'
  | 'Inactive Inquiry'
  | 'Unconfirmed Draft'
  | 'Customer-Confirmed Order';

export type Order = {
  id: string;
  customer: string;
  elapsed: string;
  status: OrderStatus;
  fulfillment: 'Pickup';
  aiPaused: boolean;
  confirmation: 'Customer-confirmed' | 'Awaiting customer confirmation';
  chatClassification: ChatClassification;
  followUp: string;
  paymentMethod: string;
  preferredTime: string;
  specialRequest?: string;
  allocationIssue?: string;
  correctionNote?: string;
  rejectionReason?: string;
  cancellationRequest?: string;
  missingDetails?: string[];
  requiredDetails: string[];
  actionState: string;
  privacyNoticeShown: boolean;
  conversation: {
    sender: 'Customer' | 'AI' | 'Business';
    text: string;
    time: string;
  }[];
  items: { qty: string; name: string; price: string; allocation: string }[];
  total: string;
};

export type CustomerSegment = 'Returning' | 'New';

export type CustomerRecord = {
  id: string;
  name: string;
  initials: string;
  segment: CustomerSegment;
  orders: number;
  lastOrder: string;
  totalSpent: string;
  purchaseHistory: Order[];
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: string;
  image: ImageSourcePropType;
  allocation: number;
  allocationLimit: number;
  status: 'Available' | 'Temporarily unavailable';
  allocationUpdatedAt: string;
  resetState: string;
  ownerOnlyNote: string;
  staffNote: string;
};

export type PromotionDraftStatus =
  | 'Needs Photo'
  | 'Needs Revision / Not Published'
  | 'Waiting for Approval'
  | 'Approved'
  | 'Published'
  | 'Failed to Publish';

export type PromotionFormat =
  | 'Text Only'
  | 'AI Template Plus Text'
  | 'Use Original Photo and Text'
  | 'Upload';

export type PromotionDraft = {
  id: string;
  title: string;
  selectedMenuItem: string;
  format: PromotionFormat;
  status: PromotionDraftStatus;
  caption: string;
  photoState: string;
  approval: string;
  publishState: string;
  availabilityCheck: string;
  referralLink: string;
  image?: ImageSourcePropType;
};

export type ScheduledDraftSlot = {
  day: string;
  time: string;
  selectedItem: string;
  format: PromotionFormat;
  status: string;
};

export type PermissionExample = {
  action: string;
  owner: string;
  defaultStaff: string;
  authorizedStaff: string;
};

export type ActivityTone = 'accepted' | 'updated' | 'sent' | 'system' | 'warning';

export type ActivityEntry = {
  id: string;
  time: string;
  title: string;
  detail: string;
  status: string;
  icon: 'pause' | 'package' | 'check' | 'lock' | 'retry' | 'bot' | 'edit' | 'shield' | 'menu';
  tone: ActivityTone;
  message?: string;
};
