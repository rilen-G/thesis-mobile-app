import type { PromotionDraft, ScheduledDraftSlot } from '@/types';

export const initialPromotionDrafts: PromotionDraft[] = [
  {
    id: 'PROMO-041', title: 'Lunch Pickup Push', selectedMenuItem: 'Chicken Pastil', format: 'Use Original Photo and Text',
    status: 'Waiting for Approval', caption: 'Lunch rush na! Chicken Pastil is available today. Message us for same-day pickup or delivery.',
    photoState: 'Stored food photo selected. The photo is used unchanged.', approval: 'Waiting for first authorized approval.',
    publishState: 'Not published yet.', availabilityCheck: 'Current allocation is above zero; ready for approval.',
    referralLink: 'm.me/lolaseatery?ref=PROMO-041', image: require('../../assets/food/pastil.jpg'),
  },
  {
    id: 'PROMO-042', title: 'AI Template Draft', selectedMenuItem: 'Pork Adobo Bowl', format: 'AI Template Plus Text',
    status: 'Needs Photo', caption: 'Pork Adobo Bowl draft is ready, but the visual format needs a selected real food photo before approval.',
    photoState: 'Needs Photo. Select an existing stored photo or upload a new real food photo.',
    approval: 'Cannot approve until the photo requirement is complete.', publishState: 'Blocked before publication.',
    availabilityCheck: 'Allocation is available, but photo requirement is incomplete.',
    referralLink: 'm.me/lolaseatery?ref=PROMO-042', image: require('../../assets/food/pork-adobo.jpg'),
  },
  {
    id: 'PROMO-043', title: 'Unavailable Item Recovery', selectedMenuItem: 'Leche Flan Cup', format: 'Text Only',
    status: 'Needs Revision / Not Published', caption: 'Leche Flan draft was approved earlier, but publication was blocked because the item is now unavailable.',
    photoState: 'No photo required for Text Only.', approval: 'Previous approval no longer applies after revision.',
    publishState: 'Not Published. Select another item or update allocation, then approve again.',
    availabilityCheck: 'Failed before publication because online allocation is zero or item is paused.',
    referralLink: 'm.me/lolaseatery?ref=PROMO-043',
  },
  {
    id: 'PROMO-044', title: 'Published Weekend Post', selectedMenuItem: 'Chicken Pastil', format: 'Text Only',
    status: 'Published', caption: "Weekend merienda? Message us to check today's Chicken Pastil availability.",
    photoState: 'No photo required for Text Only.', approval: 'Approved by Owner, Sunday 9:05 AM.',
    publishState: 'Published to Facebook Page. Post ID: FB-88421.', availabilityCheck: 'Passed before publication.',
    referralLink: 'm.me/lolaseatery?ref=PROMO-044',
  },
  {
    id: 'PROMO-045', title: 'Connection Retry Example', selectedMenuItem: 'Pork Adobo Bowl', format: 'Use Original Photo and Text',
    status: 'Failed to Publish', caption: 'Pork Adobo Bowl is available for Messenger orders today.',
    photoState: 'Stored food photo selected. The photo is used unchanged.', approval: 'Approved by Ana Santos, Thursday 9:02 AM.',
    publishState: 'Failed to Publish. Authorized users may retry after checking Facebook connection.',
    availabilityCheck: 'Passed before publication attempt.', referralLink: 'm.me/lolaseatery?ref=PROMO-045',
    image: require('../../assets/food/pork-adobo.jpg'),
  },
];

export const scheduledDraftSlots: ScheduledDraftSlot[] = [
  { day: 'Tuesday', time: '11:00 AM', selectedItem: 'Chicken Pastil', format: 'Use Original Photo and Text', status: 'Generated' },
  { day: 'Wednesday', time: '11:00 AM', selectedItem: 'Pork Adobo Bowl', format: 'AI Template Plus Text', status: 'Needs Photo' },
  { day: 'Thursday', time: '11:00 AM', selectedItem: 'No Menu Item Selected', format: 'Text Only', status: 'Skipped: No Menu Item Selected' },
  { day: 'Friday', time: '11:00 AM', selectedItem: 'Chicken Pastil', format: 'Text Only', status: 'Waiting for Approval' },
];
