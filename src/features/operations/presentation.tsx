import { router } from 'expo-router';
import {
  AlertCircle, Banknote, CalendarDays, CheckCircle2, ChevronRight,
  Clock3, History, Megaphone, MessageCircle, MessageSquareText,
  Plus, Search, ShoppingBag, TrendingUp,
  UtensilsCrossed, WalletCards, ReceiptText,
} from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/features/orders/status-badge';
import { useOperations } from '@/state/operations';
import { colors, fonts, radii, textStyles } from '@/theme/tokens';
import { filterMenu, menuAvailability, menuCategories, money, statusLabel, type MenuCategory, type OrderRecord, type Status } from './domain';
import { Copy, DataScreen, ProductPhoto, useMutation } from './ui';

function Label({ children, color = colors.ink }: { children: ReactNode; color?: string }) {
  return <Text style={[styles.label, { color, flexShrink: 1 }]}>{children}</Text>;
}

function valueDate(value: string) {
  return new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
}

function MetricCard({ icon: Icon, label, value, fullWidth = false }: { icon: typeof Banknote; label: string; value: string; fullWidth?: boolean }) {
  return <Card style={[styles.metricCard, !fullWidth && styles.metricColumn]}><View style={styles.metricLabel}><Icon color={colors.terracotta} size={22} style={{ flexShrink: 0 }} /><Label>{label}</Label></View><Text style={[styles.metricValue, fullWidth && textStyles.display]}>{value}</Text></Card>;
}

export function Dashboard() {
  const { data, loading, error } = useOperations();
  if (!data) return <DataScreen title="Your business">{!loading && !error ? <Copy>Create your business to get started.</Copy> : null}</DataScreen>;
  const today = data.orders.filter((order) => order.business_date === data.today);
  const completed = today.filter((order) => order.status === 'completed');
  const sales = completed.reduce((sum, order) => sum + order.total_centavos, 0);
  const action = today.filter((order) => order.status === 'confirmed').length;
  const productCounts = new Map<string, number>();
  for (const order of completed) for (const item of data.items.filter((candidate) => candidate.order_id === order.id)) productCounts.set(item.name, (productCounts.get(item.name) ?? 0) + item.quantity);
  const top = [...productCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'No completed orders yet';
  const topProduct = data.products.find((product) => product.name === top);
  return <DataScreen title={data.business.name}>
    <View style={styles.greeting}><Text style={styles.sectionTitle}>Magandang araw!</Text><Text style={styles.supporting}>Here&apos;s your store&apos;s performance today.</Text></View>
    {data.role === 'owner' ? <Card><Text style={styles.cardTitle}>Messenger inbox</Text><Text style={styles.smallCopy}>Review live conversations, handle customer concerns, and manage automation.</Text><AppButton label="Open Messenger inbox" onPress={() => router.push('/(owner)/messenger')} /></Card> : null}
    <MetricCard fullWidth icon={Banknote} label="End-of-Day Online Sales" value={money(sales)} />
    <View style={styles.twoColumns}><MetricCard icon={CheckCircle2} label="Completed Online Orders Today" value={String(completed.length)} /><MetricCard icon={AlertCircle} label="Orders Needing Action" value={String(action)} /></View>
    <View style={styles.twoColumns}><MetricCard icon={MessageSquareText} label="New Order-Related Conversations" value="—" /><MetricCard icon={Megaphone} label="Latest Promotional Post Reach" value="—" /></View>
    <Card style={styles.topItem}><View style={styles.flexOne}><View style={styles.metricLabel}><UtensilsCrossed color={colors.terracotta} size={22} /><Label>Top Ordered Item</Label></View><Text numberOfLines={1} style={[styles.cardTitle, { marginTop: 8 }]}>{top}</Text><Text style={styles.smallCopy}>Based on completed online orders.</Text></View>{topProduct ? <View style={styles.topPhoto}><ProductPhoto path={topProduct.photo_path} height={58} /></View> : null}</Card>
    {data.role === 'owner' ? <AppButton label="View Owner KPI Analytics" variant="ghost" onPress={() => router.push('/(owner)/metrics')} /> : null}
  </DataScreen>;
}

const orderTabs: ('all' | Status)[] = ['all', 'confirmed', 'accepted', 'ready', 'completed', 'rejected', 'expired'];

export function Orders() {
  const { data } = useOperations();
  const [filter, setFilter] = useState<'all' | Status>('all');
  const orders = data?.orders.filter((order) => filter === 'all' || order.status === filter) ?? [];
  return <DataScreen>
    <ScrollView horizontal contentContainerStyle={styles.filterRow} showsHorizontalScrollIndicator={false} style={styles.edgeScroll}>
      {orderTabs.map((status) => {
        const count = status === 'all' ? data?.orders.length ?? 0 : data?.orders.filter((order) => order.status === status).length ?? 0;
        return <Pressable key={status} onPress={() => setFilter(status)} style={[styles.chip, filter === status && styles.activeChip]}><Text style={[styles.chipText, filter === status && styles.activeChipText]}>{status === 'all' ? 'All' : statusLabel[status]} ({count})</Text></Pressable>;
      })}
    </ScrollView>
    {orders.map((order) => <OrderCard key={order.id} order={order} />)}
    {!orders.length ? <Card><Text style={styles.body}>No orders for this status.</Text></Card> : null}
  </DataScreen>;
}

function OrderCard({ order }: { order: OrderRecord }) {
  const { data } = useOperations();
  const mutation = useMutation();
  const customer = data?.customers.find((item) => item.id === order.customer_id);
  const items = data?.items.filter((item) => item.order_id === order.id) ?? [];
  const transition = order.status === 'confirmed' ? 'accepted' : order.status === 'accepted' ? 'ready' : order.status === 'ready' ? 'completed' : null;
  const actionLabel = transition === 'accepted' ? 'Accept' : transition === 'ready' ? 'Ready' : transition === 'completed' ? 'Received' : '';
  const open = () => router.push({ pathname: '/(owner)/order/[id]', params: { id: order.id } });
  const saveStatus = (status: Status) => mutation.run({ op: 'transition_order', business_id: order.business_id, id: order.id, version: order.version, status, reason: status === 'rejected' ? 'Rejected by staff' : '' });
  return <Pressable onPress={open}><Card style={styles.orderCard}>
    <View style={styles.statusFloat}><StatusBadge status={order.status} label={statusLabel[order.status]} /></View>
    <View style={{ paddingRight: 94 }}><Text style={styles.orderId}>#{order.id.slice(0, 8).toUpperCase()}</Text><Text style={styles.orderCustomer}>{customer?.name ?? 'Customer'}</Text><View style={styles.inline}><ShoppingBag color={colors.terracotta} size={14} /><Text style={styles.smallCopy}>Pickup</Text></View></View>
    <View style={styles.itemsSection}><Label>Items</Label>{items.map((item) => <View key={item.id} style={styles.itemRow}><Text style={styles.itemQty}>{item.quantity}×</Text><Text numberOfLines={1} style={styles.itemName}>{item.name}</Text><Text style={styles.itemPrice}>{money(item.price_centavos * item.quantity)}</Text></View>)}</View>
    <View style={styles.detailLines}><Label>Order Details</Label><View style={styles.inline}><WalletCards color={colors.subtleText} size={14} /><Text style={[styles.smallCopy, styles.flexOne]}><Text style={styles.bold}>Payment:</Text> {order.payment_method}</Text></View><View style={styles.inline}><Clock3 color={colors.subtleText} size={14} /><Text style={[styles.smallCopy, styles.flexOne]}><Text style={styles.bold}>Pick up time:</Text> {valueDate(order.pickup_at)}</Text></View>{order.notes ? <View style={styles.inline}><MessageSquareText color={colors.subtleText} size={14} /><Text style={[styles.smallCopy, styles.flexOne]}>{order.notes}</Text></View> : null}</View>
    <View style={styles.orderFooter}><View style={{ flexGrow: 1, minWidth: 92 }}><Text style={styles.totalLabel}>Total Amount</Text><Text style={styles.total}>{money(order.total_centavos)}</Text></View><View style={styles.orderActions}>{order.status === 'confirmed' ? <AppButton label="Reject" variant="secondary" disabled={mutation.busy} onPress={(event) => { event.stopPropagation(); open(); }} /> : null}{transition ? <AppButton label={actionLabel} disabled={mutation.busy || (transition === 'accepted' && !data?.business.rules_approved)} onPress={(event) => { event.stopPropagation(); void saveStatus(transition); }} /> : null}</View></View>
  </Card></Pressable>;
}

export function Menu() {
  const { data } = useOperations();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | MenuCategory>('All');

  const categories = ['All', ...menuCategories(data?.products ?? [])];
  const activeCategory = categories.includes(category) ? category : 'All';
  const products = filterMenu(data?.products ?? [], query, activeCategory);

  return <DataScreen>
    <SearchBox value={query} onChangeText={setQuery} placeholder="Search menu" />
    <ScrollView horizontal contentContainerStyle={styles.filterRow} showsHorizontalScrollIndicator={false} style={styles.edgeScroll}>
      {categories.map((cat) => (
        <Pressable key={cat} accessibilityRole="button" accessibilityState={{selected:activeCategory===cat}} onPress={() => setCategory(cat)} style={[styles.chip, activeCategory === cat && styles.activeChip]}>
          <Text style={[styles.chipText, activeCategory === cat && styles.activeChipText]}>{cat}</Text>
        </Pressable>
      ))}
    </ScrollView>
    <View style={styles.grid2xN}>
      {products.map((product) => {
        const allocation = data?.allocations.find((item) => item.product_id === product.id);
        const { remaining, status } = menuAvailability(product, allocation);
        const percent = allocation?.total ? Math.max(0, Math.min(100, remaining / allocation.total * 100)) : 0;
        const isAvailable = status === 'available';
        const isLow = status === 'low-stock';
        const availabilityLabel = status === 'paused' ? 'Paused' : status === 'unavailable' ? 'Unavailable' : isLow ? 'Low Stock' : 'Available';
        const statusBackground = isAvailable ? colors.readySoft : isLow ? colors.amberSoft : status === 'unavailable' ? colors.dangerSoft : colors.line;
        const statusColor = isAvailable ? colors.ready : isLow ? colors.amberDark : status === 'unavailable' ? colors.terracotta : colors.muted;
        return (
          <Pressable key={product.id} style={styles.gridCard} onPress={() => {
            if (data?.role === 'owner') {
              router.push({ pathname: '/(owner)/menu-item/[id]', params: { id: product.id } });
            }
          }}>
            <Card style={styles.menuCardCompact}>
              <View style={styles.photoWrapCompact}>
                <ProductPhoto path={product.photo_path} height={120} />
                <View style={styles.pricePill}>
                  <Text style={styles.priceText}>{money(product.price_centavos)}</Text>
                </View>
              </View>
              <View style={styles.menuBodyCompact}>
                <View style={styles.menuTitleRow}>
                  <Text numberOfLines={1} style={styles.cardTitleCompact}>{product.name}</Text>
                </View>
                <View style={styles.allocationCompact}>
                  <View style={styles.betweenCompact}>
                    <Text style={styles.smallCopy}>{remaining} left today</Text>
                    <View style={[styles.statusBadgeCompact, { backgroundColor: statusBackground }]}>
                       <Text style={[styles.statusBadgeTextCompact, { color: statusColor }]}>{availabilityLabel}</Text>
                    </View>
                  </View>
                  <View style={styles.progress}>
                    <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: isAvailable ? colors.ready : isLow ? colors.amber : '#D8C9C2' }]} />
                  </View>
                </View>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </View>
    {!products.length ? <Card><Text style={styles.body}>No matching menu items.</Text></Card> : null}
    {data?.role === 'owner' ? <AppButton label="Add Menu Item" icon={<Plus color={colors.card} size={18} />} onPress={() => router.push({ pathname: '/(owner)/menu-item/[id]', params: { id: 'new' } })} /> : null}
  </DataScreen>;
}

function SearchBox(props: { value: string; onChangeText: (value: string) => void; placeholder: string }) {
  return <View style={styles.search}><Search color={colors.muted} size={20} /><TextInput {...props} accessibilityLabel={props.placeholder} placeholderTextColor={colors.subtleText} style={styles.searchInput} /></View>;
}

export function Customers() {
  const { data } = useOperations(); const [query, setQuery] = useState(''); const [returning, setReturning] = useState<'all' | 'returning' | 'new'>('all');
  const records = useMemo(() => (data?.customers ?? []).filter((customer) => !customer.archived).map((customer) => { const orders = data?.orders.filter((order) => order.customer_id === customer.id) ?? []; const completed = orders.filter((order) => order.status === 'completed'); return { customer, orders, completed, spent: completed.reduce((sum, order) => sum + order.total_centavos, 0) }; }), [data]);
  const visible = records.filter(({ customer, completed }) => customer.name.toLowerCase().includes(query.toLowerCase()) && (returning === 'all' || (returning === 'returning' ? completed.length > 1 : completed.length <= 1)));
  return <DataScreen><SearchBox value={query} onChangeText={setQuery} placeholder="Search customers" />
    <Card style={{ padding: 12 }}><Label>Customer overview</Label><View style={styles.summaryRow}><Summary value={String(records.length)} label="Customers" /><Summary value={String(records.filter((row) => row.completed.length > 1).length)} label="Returning" bordered /><Summary value={String(records.filter((row) => row.completed.length <= 1).length)} label="New this month" /></View></Card>
    <View style={styles.customerFilters}>{(['all', 'returning', 'new'] as const).map((item) => <Pressable key={item} onPress={() => setReturning(item)} style={[styles.chip, returning === item && styles.activeChip]}><Text style={[styles.chipText, returning === item && styles.activeChipText]}>{item[0].toUpperCase() + item.slice(1)}</Text></Pressable>)}</View>
    {visible.map(({ customer, completed, spent }) => <Pressable key={customer.id} onPress={() => router.push({ pathname: '/(owner)/customer/[id]', params: { id: customer.id } })}><Card style={styles.customerCard}><View style={styles.avatar}><Text style={styles.avatarText}>{initials(customer.name)}</Text><View style={styles.messenger}><MessageCircle color="#FFF" fill="#FFF" size={13} /></View></View><View style={styles.flexOne}><View style={styles.inline}><Text numberOfLines={1} style={[styles.cardTitle, styles.flexOne]}>{customer.name}</Text><View style={styles.segment}><Text style={styles.segmentText}>{completed.length > 1 ? 'Returning' : 'New'}</Text></View></View><View style={{ gap: 4, marginTop: 8 }}><View style={styles.inline}><ShoppingBag size={13} color={colors.subtleText} /><Text style={styles.smallCopy}>{completed.length} orders</Text></View><View style={styles.inline}><CalendarDays size={13} color={colors.subtleText} /><Text style={[styles.smallCopy, styles.flexOne]}>Last order: {completed[0] ? valueDate(completed[0].pickup_at) : 'None'}</Text></View><View style={styles.inline}><ReceiptText size={13} color={colors.subtleText} /><Text style={styles.smallCopy}>Total spent: <Text style={styles.priceText}>{money(spent)}</Text></Text></View></View></View><ChevronRight color={colors.muted} size={20} /></Card></Pressable>)}
    {!visible.length ? <Card><Text style={styles.cardTitle}>No matching customers</Text><Text style={styles.body}>Try another name or customer filter.</Text></Card> : null}
    <AppButton label="Add customer" onPress={() => router.push({ pathname: '/(owner)/customer/[id]', params: { id: 'new' } })} />
  </DataScreen>;
}

function Summary({ value, label, bordered }: { value: string; label: string; bordered?: boolean }) { return <View style={[styles.summary, bordered && styles.summaryBorder]}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>; }

export function Activity() {
  const { data } = useOperations();
  const entries = data?.events ?? [];
  return <DataScreen ownerOnly><View style={styles.timeline}><View style={styles.rail} /><Text style={styles.day}>Today</Text>{entries.map((event) => <View key={event.id} style={styles.timelineEntry}><View style={styles.timelineIcon}><History color={colors.terracotta} size={17} /></View><Card style={styles.eventCard}><View style={styles.between}><Text style={styles.smallCopy}>{new Date(event.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text><View style={styles.eventBadge}><Text style={styles.eventBadgeText}>{event.action.replaceAll('_', ' ')}</Text></View></View><Text style={[styles.cardTitle, { marginTop: 10 }]}>{event.action.replaceAll('_', ' ')}</Text><Text style={styles.body}>Record {event.record_id.slice(0, 8)} · {JSON.stringify(event.detail)}</Text></Card></View>)}{!entries.length ? <Card><Text style={styles.body}>No recorded activity yet.</Text></Card> : null}</View></DataScreen>;
}

export function Promotions() {
  return <DataScreen ownerOnly>
    <Card style={styles.emptyPromos}>
      <View style={styles.emptyPromoIcon}><Megaphone color={colors.terracotta} size={24} /></View>
      <Text style={styles.cardTitle}>No promotions yet</Text>
      <Text style={[styles.body, styles.emptyPromoCopy]}>Promotion tools are still being developed. Nothing has been created for this business.</Text>
    </Card>
  </DataScreen>;
}

export function Metrics() {
  const metrics = [
    ['Avg. Promotional-Post Reach', '—', 'Testing average compared with 30-day baseline.'],
    ['New Order-Related Conversations', '—', 'Distinct new Messenger threads about ordering.'],
    ['Chat-to-Sale Conversion Rate', '—', 'Completed chat orders divided by order-related conversations.'],
    ['Promotion-to-Chat Conversion Rate', '—', 'Tracked referral conversations divided by post reach.'],
    ['Follow-Up Response Rate', '—', 'Eligible stalled chats completed after one app follow-up.'],
  ];
  return <DataScreen title="KPI Analytics" detail ownerOnly><Card style={{ backgroundColor: '#FFFAF4' }}><View style={styles.metricLabel}><TrendingUp color={colors.terracotta} size={22} /><Text style={styles.cardTitle}>KPI Analytics</Text></View><Text style={styles.smallCopy}>Values remain unavailable until the research integrations are connected. No sample result is presented as real data.</Text></Card><View style={styles.twoColumns}>{metrics.slice(0, 4).map(([label, value, note]) => <Card key={label} style={styles.analyticsCard}><Label>{label}</Label><Text style={styles.analyticsValue}>{value}</Text><Text style={styles.summaryLabel}>{note}</Text></Card>)}</View><Card><Label>Follow-Up Response Rate</Label><Text style={styles.analyticsValue}>{metrics[4][1]}</Text><Text style={styles.smallCopy}>{metrics[4][2]}</Text></Card><Card><View style={styles.metricLabel}><UtensilsCrossed color={colors.terracotta} size={22} /><Text style={styles.cardTitle}>Menu-Item Order Performance</Text></View><Text style={styles.smallCopy}>Completed order quantity and online sales become available from saved order records.</Text></Card></DataScreen>;
}

const styles = StyleSheet.create({
  greeting: { marginBottom: 2 }, sectionTitle: { ...textStyles.title }, supporting: { ...textStyles.body, marginTop: 4, color: '#553A33', fontSize: 13 },
  label: { fontFamily: fonts.extraBold, fontSize: 12, lineHeight: 16 }, body: { ...textStyles.body, marginTop: 4 }, bold: { fontFamily: fonts.extraBold, color: colors.ink },
  metricColumn: { flex: 1, minWidth: 0 }, metricCard: { minHeight: 112, gap: 12, justifyContent: 'space-between' }, metricLabel: { alignItems: 'center', flexDirection: 'row', gap: 8 }, metricValue: { ...textStyles.display, fontSize: 22, lineHeight: 28 },
  twoColumns: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, analyticsCard: { flexBasis: '45%', flexGrow: 1, minHeight: 136 }, analyticsValue: { ...textStyles.headline, marginTop: 12 },
  cardTitle: { ...textStyles.title }, smallCopy: { ...textStyles.tiny, marginTop: 2 }, flexOne: { flex: 1, minWidth: 0 }, inline: { alignItems: 'center', flexDirection: 'row', gap: 8 }, between: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  topItem: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 112 }, topPhoto: { borderRadius: radii.md, height: 58, overflow: 'hidden', width: 66 },
  promoCandidate: { backgroundColor: colors.amberSoft, borderColor: '#FFD76B', borderRadius: radii.md, borderWidth: 1, padding: 16 }, promoCopy: { ...textStyles.body, color: '#5A4036', marginTop: 10 },
  edgeScroll: { marginHorizontal: -16, flexGrow: 0, flexShrink: 0 }, customerFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 }, chip: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.line, borderRadius: radii.pill, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: 16 }, activeChip: { backgroundColor: colors.terracotta, borderColor: colors.terracotta }, chipText: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 13 }, activeChipText: { color: colors.card },
  orderCard: { overflow: 'hidden', position: 'relative' }, statusFloat: { position: 'absolute', right: 16, top: 16 }, orderId: { color: colors.terracotta, fontFamily: fonts.extraBold, fontSize: 12, textTransform: 'uppercase' }, orderCustomer: { color: '#4D3833', fontFamily: fonts.extraBold, fontSize: 20, lineHeight: 25, marginTop: 7 },
  itemsSection: { gap: 4, marginTop: 16 }, itemRow: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 5 }, itemQty: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 13, width: 34 }, itemName: { color: '#4F4541', flex: 1, fontFamily: fonts.medium, fontSize: 13 }, itemPrice: { color: colors.ink, fontFamily: fonts.semiBold, fontSize: 13 },
  detailLines: { borderBottomColor: colors.line, borderBottomWidth: 1, gap: 7, marginTop: 10, paddingBottom: 12 }, orderFooter: { alignItems: 'flex-end', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }, orderActions: { flexDirection: 'row', gap: 8, marginLeft: 'auto' }, totalLabel: { color: colors.muted, fontFamily: fonts.bold, fontSize: 12 }, total: { color: colors.terracotta, fontFamily: fonts.extraBold, fontSize: 24, lineHeight: 30 },
  search: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 48, paddingHorizontal: 12 }, searchInput: { minWidth: 0, color: colors.ink, flex: 1, fontFamily: fonts.semiBold, fontSize: 16 },
  menuCard: { overflow: 'hidden', padding: 0 }, photoWrap: { height: 144, overflow: 'hidden', position: 'relative' }, pricePill: { backgroundColor: colors.card, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 5, position: 'absolute', right: 12, top: 12 }, priceText: { color: colors.terracotta, fontFamily: fonts.extraBold, fontSize: 13 }, menuBody: { gap: 12, padding: 16 }, allocation: { backgroundColor: colors.menuSoft, borderRadius: radii.md, padding: 12 }, progress: { backgroundColor: colors.line, borderRadius: radii.pill, height: 8, marginTop: 10, overflow: 'hidden' }, progressFill: { borderRadius: radii.pill, height: 8 },
  summaryRow: { flexDirection: 'row', marginTop: 12 }, summary: { flex: 1, paddingHorizontal: 12 }, summaryBorder: { borderLeftColor: colors.line, borderLeftWidth: 1, borderRightColor: colors.line, borderRightWidth: 1 }, summaryValue: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 20 }, summaryLabel: { color: colors.muted, fontFamily: fonts.semiBold, fontSize: 11, lineHeight: 14, marginTop: 2 },
  customerCard: { alignItems: 'center', flexDirection: 'row', gap: 12 }, avatar: { alignItems: 'center', backgroundColor: '#F3EDE3', borderRadius: 28, height: 56, justifyContent: 'center', position: 'relative', width: 56 }, avatarText: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 18 }, messenger: { alignItems: 'center', backgroundColor: colors.messenger, borderColor: colors.card, borderRadius: 12, borderWidth: 2, bottom: -3, height: 24, justifyContent: 'center', position: 'absolute', right: -3, width: 24 }, segment: { backgroundColor: colors.amberSoft, borderRadius: radii.sm, paddingHorizontal: 8, paddingVertical: 4 }, segmentText: { color: colors.amberDark, fontFamily: fonts.extraBold, fontSize: 10 },
  timeline: { paddingLeft: 4, position: 'relative' }, rail: { backgroundColor: '#E5B9AD', bottom: 12, left: 25, position: 'absolute', top: 36, width: 2 }, day: { color: colors.muted, fontFamily: fonts.extraBold, fontSize: 14, marginBottom: 16, marginLeft: 50 }, timelineEntry: { flexDirection: 'row', gap: 12, marginBottom: 20 }, timelineIcon: { alignItems: 'center', backgroundColor: colors.terracottaSoft, borderColor: colors.cream, borderRadius: 22, borderWidth: 6, height: 44, justifyContent: 'center', width: 44, zIndex: 1 }, eventCard: { flex: 1 }, eventBadge: { backgroundColor: colors.amberSoft, borderRadius: radii.pill, maxWidth: 122, paddingHorizontal: 9, paddingVertical: 5 }, eventBadgeText: { color: colors.amberDark, fontFamily: fonts.semiBold, fontSize: 11, textTransform: 'capitalize' },
  emptyPromos: { alignItems: 'center', minHeight: 180, justifyContent: 'center' }, emptyPromoIcon: { alignItems: 'center', backgroundColor: colors.terracottaSoft, borderRadius: radii.pill, height: 48, justifyContent: 'center', marginBottom: 12, width: 48 }, emptyPromoCopy: { maxWidth: 280, textAlign: 'center' },
  grid2xN: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  gridCard: { flexBasis: '47%', flexGrow: 1, maxWidth: '50%' },
  menuCardCompact: { overflow: 'hidden', padding: 0 },
  photoWrapCompact: { height: 120, overflow: 'hidden', position: 'relative' },
  menuBodyCompact: { padding: 12, gap: 8 },
  menuTitleRow: { minHeight: 24, justifyContent: 'center' },
  cardTitleCompact: { ...textStyles.title, fontSize: 15, lineHeight: 18 },
  allocationCompact: { marginTop: 2 },
  betweenCompact: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  statusBadgeCompact: { borderRadius: radii.pill, paddingHorizontal: 6, paddingVertical: 2 },
  statusBadgeTextCompact: { fontFamily: fonts.extraBold, fontSize: 10 },
});
