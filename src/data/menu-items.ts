import type { MenuItem } from '@/types';

export const initialMenuItems: MenuItem[] = [
  {
    id: 'chicken-pastil', name: 'Chicken Pastil',
    description: 'Savory shredded chicken adobo served over steamed rice, traditionally wrapped in banana leaf.',
    price: '₱95', image: require('../../assets/food/pastil.jpg'), allocation: 45, allocationLimit: 50,
    status: 'Available', allocationUpdatedAt: 'Set today at 7:45 AM',
    resetState: 'Today only; remaining capacity will not carry over tomorrow.',
    ownerOnlyNote: 'Owner can edit name, price, description, and photo.',
    staffNote: 'Default staff can pause availability and update daily allocation only if authorized.',
  },
  {
    id: 'pork-adobo-bowl', name: 'Pork Adobo Bowl',
    description: 'Tender pork adobo with rich soy-vinegar sauce, served with warm rice for Messenger orders.',
    price: '₱125', image: require('../../assets/food/pork-adobo.jpg'), allocation: 7, allocationLimit: 20,
    status: 'Available', allocationUpdatedAt: 'Set today at 7:50 AM',
    resetState: 'Capacity-control count for Messenger orders only.',
    ownerOnlyNote: 'Owner can edit menu records and approve price changes.',
    staffNote: 'Authorized staff may adjust allocation before accepting chat orders.',
  },
  {
    id: 'leche-flan-cup', name: 'Leche Flan Cup',
    description: 'Creamy caramel custard packed in a single-serve cup for pickup or delivery add-ons.',
    price: '₱125', image: require('../../assets/food/leche-flan.jpg'), allocation: 12, allocationLimit: 30,
    status: 'Temporarily unavailable', allocationUpdatedAt: 'Marked unavailable today at 11:20 AM',
    resetState: 'Unavailable items are not suggested, ordered, or selected for new promo drafts.',
    ownerOnlyNote: 'Owner can update photo, description, and pricing when item returns.',
    staffNote: 'Default staff can mark an item temporarily unavailable during operations.',
  },
];
