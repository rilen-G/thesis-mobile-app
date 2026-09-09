import { router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, ChevronRight, MessageCircle, ShoppingBag, Tag } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/layout/app-screen';
import { Card } from '@/components/ui/card';
import { getStatusLabel } from '@/features/orders/order-utils';
import { StatusBadge } from '@/features/orders/status-badge';
import { useAppData } from '@/state/app-data';
import { colors, fonts, radii, spacing, textStyles } from '@/theme/tokens';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const customer = useAppData().customers.find((item) => item.id === id);
  if (!customer) return <AppScreen detail hideSettings title="Customer Details"><Card><Text style={textStyles.body}>Customer not found.</Text></Card></AppScreen>;
  return <AppScreen backLabel="Back to customers" detail title="Customer Details">
    <Card style={styles.profile}><View style={styles.avatar}><Text style={styles.initials}>{customer.initials}</Text><View style={styles.messenger}><MessageCircle color={colors.card} fill={colors.card} size={14} /></View></View><View style={styles.flex}><View style={styles.nameRow}><Text style={styles.name}>{customer.name}</Text><Text style={[styles.segment, customer.segment === 'Returning' ? styles.returning : styles.new]}>{customer.segment}</Text></View><Text style={styles.sub}>Messenger customer record</Text></View></Card>
    <Card style={styles.summary}><Text style={textStyles.label}>Customer summary</Text><View style={styles.metrics}><Metric icon={<ShoppingBag color={colors.terracotta} size={15} />} label="Orders" value={`${customer.orders}`} /><Metric bordered icon={<Tag color={colors.terracotta} size={15} />} label="Total spent" value={customer.totalSpent} /><Metric icon={<CalendarDays color={colors.terracotta} size={15} />} label="Last order" value={customer.lastOrder.replace(', 2025','')} /></View></Card>
    <View><Text style={styles.section}>Purchase history</Text><Text style={styles.sub}>Showing the most recent orders in this record.</Text></View>
    {customer.purchaseHistory.map((order) => <Pressable key={order.id} onPress={() => router.push({ pathname: '/(owner)/order/[id]', params: { id: order.id } })}><Card style={styles.order}><View style={styles.flex}><View style={styles.orderTop}><Text style={styles.orderId}>#{order.id}</Text><StatusBadge label={getStatusLabel(order.status)} status={order.status} /></View><Text numberOfLines={1} style={styles.orderItems}>{order.items.map((item) => `${item.qty} ${item.name}`).join(', ')}</Text><View style={styles.orderBottom}><Text style={styles.sub}>{order.preferredTime}</Text><Text style={styles.spent}>{order.total}</Text></View></View><ChevronRight color={colors.muted} size={20} /></Card></Pressable>)}
  </AppScreen>;
}

function Metric({ icon, value, label, bordered }: { icon: ReactNode; value: string; label: string; bordered?: boolean }) { return <View style={[styles.metric, bordered && styles.bordered]}>{icon}<Text numberOfLines={1} style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  profile: { alignItems: 'center', flexDirection: 'row', gap: spacing.md }, avatar: { alignItems: 'center', backgroundColor: '#F3EDE3', borderRadius: 32, height: 64, justifyContent: 'center', width: 64 }, initials: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 20 }, messenger: { alignItems: 'center', backgroundColor: colors.messenger, borderColor: colors.card, borderRadius: 14, borderWidth: 2, bottom: -4, height: 28, justifyContent: 'center', position: 'absolute', right: -4, width: 28 },
  flex: { flex: 1 }, nameRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, name: { ...textStyles.headline }, segment: { borderRadius: radii.sm, fontFamily: fonts.extraBold, fontSize: 10, overflow: 'hidden', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }, returning: { backgroundColor: colors.amberSoft, color: colors.amberDark }, new: { backgroundColor: colors.terracottaSoft, color: colors.terracottaDark }, sub: { ...textStyles.tiny, marginTop: spacing.xs },
  summary: { padding: spacing.md }, metrics: { flexDirection: 'row', marginTop: spacing.md }, metric: { flex: 1, gap: spacing.xs, paddingHorizontal: spacing.sm }, bordered: { borderLeftColor: colors.line, borderLeftWidth: 1, borderRightColor: colors.line, borderRightWidth: 1 }, metricValue: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 14 }, metricLabel: { ...textStyles.tiny, fontSize: 10 }, section: { ...textStyles.title },
  order: { alignItems: 'center', flexDirection: 'row', gap: spacing.md }, orderTop: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, orderId: { color: colors.terracotta, fontFamily: fonts.extraBold, fontSize: 13 }, orderItems: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 15, marginTop: spacing.sm }, orderBottom: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, spent: { color: colors.terracotta, fontFamily: fonts.extraBold, fontSize: 12 },
});
