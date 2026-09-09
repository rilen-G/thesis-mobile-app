import type { CustomerRecord, Order } from '@/types';

function completedPurchase(
  id: string,
  customer: string,
  elapsed: string,
  preferredTime: string,
  itemName: string,
  qty: string,
  total: string,
  paymentMethod = 'GCash',
): Order {
  return {
    id, customer, elapsed, status: 'Completed', fulfillment: 'Pickup', aiPaused: false,
    confirmation: 'Customer-confirmed', chatClassification: 'Customer-Confirmed Order',
    followUp: 'Completed purchase retained in the customer record.', paymentMethod, preferredTime,
    requiredDetails: ['Menu item', 'Quantity', 'Order type'],
    actionState: 'Completed order. Customer concerns are handled manually.', privacyNoticeShown: true,
    conversation: [
      { sender: 'Customer', text: `Confirmed ${qty} ${itemName} for pickup.`, time: '11:20 AM' },
      { sender: 'Business', text: 'Payment received and order completed.', time: '12:05 PM' },
    ],
    items: [{ qty, name: itemName, price: total, allocation: 'Deducted on acceptance' }], total,
  };
}

export const initialCustomers: CustomerRecord[] = [
  {
    id: 'maria', name: 'Maria Santos', initials: 'MS', segment: 'Returning', orders: 12,
    lastOrder: 'May 16, 2025', totalSpent: '₱2,450',
    purchaseHistory: [
      completedPurchase('HIST-1208', 'Maria Santos', 'May 16', 'May 16, 12:30 PM', 'Chicken Pastil', '2x', '₱190.00'),
      completedPurchase('HIST-1174', 'Maria Santos', 'May 9', 'May 9, 1:00 PM', 'Pork Adobo Bowl', '1x', '₱125.00', 'Cash'),
      completedPurchase('HIST-1121', 'Maria Santos', 'Apr 28', 'Apr 28, 3:15 PM', 'Leche Flan Cup', '2x', '₱250.00'),
    ],
  },
  {
    id: 'carlo', name: 'Carlo Reyes', initials: 'CR', segment: 'Returning', orders: 7,
    lastOrder: 'May 13, 2025', totalSpent: '₱1,680',
    purchaseHistory: [
      completedPurchase('HIST-1192', 'Carlo Reyes', 'May 13', 'May 13, 11:45 AM', 'Pork Adobo Bowl', '2x', '₱250.00'),
      completedPurchase('HIST-1108', 'Carlo Reyes', 'Apr 22', 'Apr 22, 2:00 PM', 'Chicken Pastil', '3x', '₱285.00'),
    ],
  },
  {
    id: 'ana', name: 'Ana Cruz', initials: 'AC', segment: 'New', orders: 3,
    lastOrder: 'May 10, 2025', totalSpent: '₱750',
    purchaseHistory: [
      completedPurchase('HIST-1183', 'Ana Cruz', 'May 10', 'May 10, 4:30 PM', 'Leche Flan Cup', '2x', '₱250.00'),
      completedPurchase('HIST-1150', 'Ana Cruz', 'May 3', 'May 3, 12:15 PM', 'Chicken Pastil', '2x', '₱190.00'),
    ],
  },
  {
    id: 'joel', name: 'Joel Mendoza', initials: 'JM', segment: 'Returning', orders: 5,
    lastOrder: 'May 8, 2025', totalSpent: '₱1,240',
    purchaseHistory: [
      completedPurchase('HIST-1171', 'Joel Mendoza', 'May 8', 'May 8, 1:30 PM', 'Pork Adobo Bowl', '2x', '₱250.00'),
      completedPurchase('HIST-1095', 'Joel Mendoza', 'Apr 18', 'Apr 18, 5:15 PM', 'Chicken Pastil', '2x', '₱190.00'),
    ],
  },
];
