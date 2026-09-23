export type Role = 'owner' | 'staff';
export type Status = 'confirmed' | 'accepted' | 'ready' | 'completed' | 'rejected' | 'expired';
export type Business = { id: string; name: string; address: string; opening_time: string; cutoff_time: string; rules_approved: boolean; restore_before_preparing: boolean; default_post_format: string; version: number };
export type Member = { business_id: string; user_id: string; role: Role; display_name: string };
export type MenuCategory = string;
export function menuCategories(products: Product[]): string[] {
  return [...new Set(products.flatMap((product) => product.category ? [product.category] : []))].sort((a,b)=>a.localeCompare(b));
}
export type Product = { id: string; business_id: string; name: string; description: string; price_centavos: number; active: boolean; photo_path: string | null; category?: MenuCategory | null; version: number };
export function filterMenu(products: Product[], query: string, category: 'All' | MenuCategory) {
  return products.filter((product) => product.name.toLowerCase().includes(query.trim().toLowerCase()) && (category === 'All' || product.category === category));
}
export type Allocation = { product_id: string; business_id: string; business_date: string; total: number; used: number; version: number };
export type MenuAvailability = 'paused' | 'unavailable' | 'low-stock' | 'available';
export function menuAvailability(product: Pick<Product, 'active'>, allocation?: Pick<Allocation, 'total' | 'used'>) {
  const remaining = Math.max(0, (allocation?.total ?? 0) - (allocation?.used ?? 0));
  const status: MenuAvailability = !product.active
    ? 'paused'
    : remaining === 0
      ? 'unavailable'
      : remaining < 5
        ? 'low-stock'
        : 'available';
  return { remaining, status };
}
export type Customer = { id: string; business_id: string; name: string; phone: string; notes: string; archived: boolean; version: number };
export type OrderRecord = { id: string; business_id: string; customer_id: string; status: Status; total_centavos: number; pickup_at: string; business_date: string; payment_method: string; notes: string; created_at: string; version: number; restore_before_preparing: boolean };
export type OrderItem = { id: string; order_id: string; business_id: string; product_id: string; name: string; quantity: number; price_centavos: number };
export type Audit = { id: string; business_id: string; actor_id: string; action: string; record_id: string; detail: Record<string, unknown>; created_at: string };
export type Snapshot = { business: Business; role: Role; members: Member[]; products: Product[]; allocations: Allocation[]; customers: Customer[]; orders: OrderRecord[]; items: OrderItem[]; events: Audit[]; today: string };
export type Command = { op: string; business_id?: string; [key: string]: unknown };
export function money(value: number) { return `₱${(value / 100).toFixed(2)}`; }
export function parsePrice(value: string) {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value.trim())) throw new Error('Enter a valid peso price with up to two decimal places.');
  const [whole, fraction = ''] = value.trim().split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export function quantity(value: string) {
  if (!/^\d{1,6}$/.test(value)) throw new Error('Quantity must be a whole number between 0 and 999999.');
  return Number(value);
}
export function pickupTimestamp(day: string, time: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Enter pickup time as HH:MM (24-hour time).');
  return `${day}T${time}:00+08:00`;
}
export const transitions: Record<Status, Status[]> = {
  confirmed: ['accepted', 'rejected'], accepted: ['ready', 'rejected'], ready: ['completed'],
  completed: [], rejected: [], expired: [],
};
export const statusLabel: Record<Status, string> = { confirmed: 'Confirmed', accepted: 'Accepted', ready: 'Ready', completed: 'Completed', rejected: 'Rejected', expired: 'Expired' };
