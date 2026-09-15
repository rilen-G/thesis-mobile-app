import type { Order } from '@/types';

const requiredDetails = ['Menu item', 'Quantity', 'Order type'];

export const initialOrders: Order[] = [
  {
    id: 'ORD-902', customer: 'Juan Dela Cruz', elapsed: '2 mins ago',
    status: 'Confirmed', fulfillment: 'Pickup', aiPaused: false,
    confirmation: 'Customer-confirmed', chatClassification: 'Customer-Confirmed Order',
    followUp: 'No follow-up needed while staff acceptance is pending.', paymentMethod: 'GCash',
    preferredTime: 'Today, 12:30 PM', specialRequest: 'Extra sabaw.',
    correctionNote: 'Customer corrected the pickup time before confirming.', requiredDetails,
    actionState: 'Ready for staff acceptance. Online allocation will be deducted after acceptance.', privacyNoticeShown: true,
    conversation: [
      { sender: 'AI', text: 'Privacy notice sent before collecting order details.', time: '11:24 AM' },
      { sender: 'Customer', text: 'Paorder 2 chicken pastil and 1 pork adobo. Pickup po.', time: '11:26 AM' },
      { sender: 'AI', text: 'Order summary sent with items, food subtotal, pickup details, and request for confirmation.', time: '11:28 AM' },
      { sender: 'Customer', text: 'Confirmed. Please make it 12:30 PM.', time: '11:29 AM' },
    ],
    total: '₱315.00',
    items: [
      { qty: '2x', name: 'Chicken Pastil', price: '₱190.00', allocation: '18 left' },
      { qty: '1x', name: 'Pork Adobo Bowl', price: '₱125.00', allocation: '7 left' },
    ],
  },
  {
    id: 'ORD-903', customer: 'Maria Santos', elapsed: '10 mins ago',
    status: 'Confirmed', fulfillment: 'Pickup', aiPaused: true,
    confirmation: 'Customer-confirmed', chatClassification: 'Customer-Confirmed Order',
    followUp: 'AI paused for manual correction. Follow-ups and summaries are stopped.', paymentMethod: 'Cash',
    preferredTime: 'Today, 1:00 PM', allocationIssue: 'Leche Flan Cup is currently paused for Messenger orders.',
    requiredDetails, actionState: 'Authorized staff may restore availability if food is actually available, or reject with an apology.',
    privacyNoticeShown: true,
    conversation: [
      { sender: 'Customer', text: 'May Leche Flan Cup pa po ba for pickup?', time: '11:18 AM' },
      { sender: 'AI', text: 'Order summary created after the customer confirmed item and pickup time.', time: '11:20 AM' },
      { sender: 'Business', text: 'Manual check muna, naka-pause ang AI habang kino-confirm ang allocation.', time: '11:21 AM' },
    ],
    total: '₱125.00', items: [{ qty: '1x', name: 'Leche Flan Cup', price: '₱125.00', allocation: 'Paused for chat orders' }],
  },
  {
    id: 'ORD-905', customer: 'Liza Ramos', elapsed: '25 mins ago', status: 'Rejected', fulfillment: 'Pickup', aiPaused: false,
    confirmation: 'Awaiting customer confirmation', chatClassification: 'Incomplete Order',
    followUp: 'No follow-up needed because the customer clearly cancelled before confirming the order.',
    paymentMethod: 'Not collected', preferredTime: 'Today, 2:00 PM',
    cancellationRequest: 'Customer clearly cancelled before order confirmation, so the AI marked the order Rejected and informed staff.',
    requiredDetails, actionState: 'No allocation was deducted. Staff is only informed.', privacyNoticeShown: true,
    conversation: [
      { sender: 'Customer', text: 'Cancel ko na po muna yung order.', time: '11:06 AM' },
      { sender: 'AI', text: 'Order marked Rejected before acceptance. No allocation deducted.', time: '11:06 AM' },
    ],
    total: '₱95.00', items: [{ qty: '1x', name: 'Chicken Pastil', price: '₱95.00', allocation: '45 left' }],
  },
  {
    id: 'ORD-906', customer: 'Rina Cruz', elapsed: '40 mins ago', status: 'Accepted', fulfillment: 'Pickup', aiPaused: false,
    confirmation: 'Customer-confirmed', chatClassification: 'Customer-Confirmed Order',
    followUp: 'Customer cancellation is no longer available once the order is confirmed and accepted.',
    paymentMethod: 'GCash through the business process', preferredTime: 'Today, 12:45 PM',
    cancellationRequest: 'Customer asked to cancel after confirmation. Staff handles the concern manually without changing the accepted order status.',
    requiredDetails, actionState: 'Staff may continue fulfillment and mark the order Ready once the food is prepared.', privacyNoticeShown: true,
    conversation: [
      { sender: 'Business', text: 'Accepted. Payment and pickup instructions sent.', time: '10:31 AM' },
      { sender: 'Customer', text: 'Pwede pa po ba i-cancel?', time: '10:51 AM' },
      { sender: 'AI', text: 'Cancellation request recorded. Staff review required.', time: '10:51 AM' },
    ],
    total: '₱190.00', items: [{ qty: '2x', name: 'Chicken Pastil', price: '₱190.00', allocation: 'Reserved from accepted order' }],
  },
  {
    id: 'ORD-910', customer: 'Paolo Garcia', elapsed: '45 mins ago', status: 'Ready', fulfillment: 'Pickup', aiPaused: false,
    confirmation: 'Customer-confirmed', chatClassification: 'Customer-Confirmed Order',
    followUp: 'Customer was notified that the order is ready for pickup.', paymentMethod: 'GCash',
    preferredTime: 'Today, 1:15 PM', specialRequest: 'Please include extra chili oil.', requiredDetails,
    actionState: 'Food is prepared and waiting for customer pickup. Staff may mark it received after payment and handover.', privacyNoticeShown: true,
    conversation: [
      { sender: 'Customer', text: 'Paorder po 1 pork adobo and 1 leche flan for pickup.', time: '10:40 AM' },
      { sender: 'Business', text: 'Accepted. Pickup order is now being prepared.', time: '10:43 AM' },
      { sender: 'Business', text: 'Order marked Ready. Waiting for customer pickup.', time: '11:12 AM' },
    ],
    total: '₱250.00', items: [
      { qty: '1x', name: 'Pork Adobo Bowl', price: '₱125.00', allocation: 'Reserved from accepted order' },
      { qty: '1x', name: 'Leche Flan Cup', price: '₱125.00', allocation: 'Reserved from accepted order' },
    ],
  },
  {
    id: 'ORD-907', customer: 'Nico Tan', elapsed: 'Yesterday', status: 'Completed', fulfillment: 'Pickup', aiPaused: false,
    confirmation: 'Customer-confirmed', chatClassification: 'Customer-Confirmed Order',
    followUp: 'Completed sale counted in online sales after payment and handover were confirmed.', paymentMethod: 'Cash',
    preferredTime: 'Yesterday, 6:00 PM', requiredDetails,
    actionState: 'Locked as a completed sale. Refunds or concerns are handled manually outside the app.', privacyNoticeShown: true,
    conversation: [
      { sender: 'Business', text: 'Order marked Ready.', time: '5:48 PM' },
      { sender: 'Business', text: 'Payment received and food handed over. Order completed.', time: '6:03 PM' },
    ],
    total: '₱375.00', items: [
      { qty: '2x', name: 'Pork Adobo Bowl', price: '₱250.00', allocation: 'Deducted on acceptance' },
      { qty: '1x', name: 'Leche Flan Cup', price: '₱125.00', allocation: 'Deducted on acceptance' },
    ],
  },
  {
    id: 'ORD-908', customer: 'Aly Mendoza', elapsed: 'Yesterday', status: 'Expired', fulfillment: 'Pickup', aiPaused: false,
    confirmation: 'Awaiting customer confirmation', chatClassification: 'Inactive Inquiry',
    followUp: 'One transactional follow-up was sent; the order summary expired after no confirmation.',
    paymentMethod: 'Not collected', preferredTime: 'Not provided', missingDetails: ['Customer confirmation'], requiredDetails,
    actionState: 'Expired order summaries are not counted as completed sales and do not deduct allocation.', privacyNoticeShown: true,
    conversation: [
      { sender: 'Customer', text: 'Magkano chicken pastil?', time: '4:10 PM' },
      { sender: 'AI', text: 'Answered price and availability, then sent a single follow-up later in the Messenger window.', time: '4:11 PM' },
    ],
    total: '₱0.00', items: [{ qty: '1x', name: 'Chicken Pastil', price: '₱95.00', allocation: 'No deduction' }],
  },
  {
    id: 'ORD-909', customer: 'Bea Lim', elapsed: '1 hr ago', status: 'Rejected', fulfillment: 'Pickup', aiPaused: false,
    confirmation: 'Customer-confirmed', chatClassification: 'Customer-Confirmed Order',
    followUp: 'Rejected orders are separate from cancellations and are not counted as sales.', paymentMethod: 'Not collected',
    preferredTime: 'Today, 12:00 PM', rejectionReason: 'Unavailable preparation capacity for the requested time.', requiredDetails,
    actionState: 'AI sent a polite rejection and may suggest available alternatives.', privacyNoticeShown: true,
    conversation: [
      { sender: 'Customer', text: 'Confirmed po, 10 chicken pastil pickup before noon.', time: '9:50 AM' },
      { sender: 'Business', text: 'Rejected because the kitchen cannot accommodate the requested time.', time: '9:55 AM' },
    ],
    total: '₱950.00', items: [{ qty: '10x', name: 'Chicken Pastil', price: '₱950.00', allocation: 'No deduction' }],
  },
];
