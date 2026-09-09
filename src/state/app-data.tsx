import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

import { initialCustomers } from '@/data/customers';
import { initialMenuItems } from '@/data/menu-items';
import { initialOrders } from '@/data/orders';
import { initialPromotionDrafts } from '@/data/promotions';
import type { CustomerRecord, MenuItem, Order, OrderStatus, PromotionDraft, PromotionDraftStatus } from '@/types';

type EditableOrder = Pick<Order, 'customer' | 'paymentMethod' | 'preferredTime' | 'specialRequest'>;
type EditableMenu = Pick<MenuItem, 'name' | 'price' | 'description' | 'allocation' | 'status'>;

type AppData = {
  orders: Order[];
  customers: CustomerRecord[];
  menuItems: MenuItem[];
  promotions: PromotionDraft[];
  defaultPostFormat: string;
  setDefaultPostFormat: (format: string) => void;
  updateOrderStatus: (id: string, status: OrderStatus) => void;
  updateOrder: (id: string, updates: EditableOrder) => void;
  updateMenuItem: (id: string, updates: EditableMenu) => void;
  addMenuItem: () => string;
  updatePromotion: (id: string, updates: Partial<Pick<PromotionDraft, 'caption' | 'status' | 'approval' | 'publishState'>>) => void;
  actOnPromotion: (id: string) => void;
};

const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState(initialOrders);
  const [customers, setCustomers] = useState(initialCustomers);
  const [menuItems, setMenuItems] = useState(initialMenuItems);
  const [promotions, setPromotions] = useState(initialPromotionDrafts);
  const [defaultPostFormat, setDefaultPostFormat] = useState('Text only');

  const updateOrderStatus = (id: string, status: OrderStatus) => {
    setOrders((items) => items.map((order) => order.id === id ? { ...order, status } : order));
    setCustomers((items) => items.map((customer) => ({
      ...customer,
      purchaseHistory: customer.purchaseHistory.map((order) => order.id === id ? { ...order, status } : order),
    })));
  };

  const updateOrder = (id: string, updates: EditableOrder) => {
    setOrders((items) => items.map((order) => order.id === id ? { ...order, ...updates } : order));
    setCustomers((items) => items.map((customer) => ({
      ...customer,
      purchaseHistory: customer.purchaseHistory.map((order) => order.id === id ? { ...order, ...updates } : order),
    })));
  };

  const updateMenuItem = (id: string, updates: EditableMenu) => {
    setMenuItems((items) => items.map((item) => item.id === id ? { ...item, ...updates, allocationUpdatedAt: 'Updated just now' } : item));
  };

  const addMenuItem = () => {
    const id = `new-item-${Date.now()}`;
    setMenuItems((items) => [...items, {
      id, name: 'New Menu Item', description: 'Add a clear description for Messenger customers.', price: '₱0',
      image: require('../../assets/food/pastil.jpg'), allocation: 0, allocationLimit: 50, status: 'Temporarily unavailable',
      allocationUpdatedAt: 'Not allocated yet', resetState: 'Today only.',
      ownerOnlyNote: 'Owner can edit name, price, description, and photo.',
      staffNote: 'Authorized staff permissions are enforced by the backend in production.',
    }]);
    return id;
  };

  const updatePromotion = (id: string, updates: Partial<Pick<PromotionDraft, 'caption' | 'status' | 'approval' | 'publishState'>>) => {
    setPromotions((items) => items.map((draft) => draft.id === id ? { ...draft, ...updates } : draft));
  };

  const actOnPromotion = (id: string) => {
    setPromotions((items) => items.map((draft) => {
      if (draft.id !== id) return draft;
      let status: PromotionDraftStatus = draft.status;
      if (draft.status === 'Waiting for Approval') status = 'Approved';
      if (draft.status === 'Needs Photo') status = 'Waiting for Approval';
      if (draft.status === 'Needs Revision / Not Published') status = 'Waiting for Approval';
      if (draft.status === 'Failed to Publish') status = 'Published';
      return { ...draft, status, approval: status === 'Approved' ? 'Approved in this prototype session.' : draft.approval, publishState: status === 'Published' ? 'Published in this prototype session.' : draft.publishState };
    }));
  };

  const value = useMemo<AppData>(() => ({
    orders, customers, menuItems, promotions, defaultPostFormat, setDefaultPostFormat,
    updateOrderStatus, updateOrder, updateMenuItem, addMenuItem, updatePromotion, actOnPromotion,
  }), [customers, defaultPostFormat, menuItems, orders, promotions]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const value = useContext(AppDataContext);
  if (!value) throw new Error('useAppData must be used inside AppDataProvider');
  return value;
}
