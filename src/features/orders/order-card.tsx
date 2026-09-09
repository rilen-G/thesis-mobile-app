import { router } from 'expo-router';
import { AlertCircle, Clock3, MessageSquareText, ShoppingBasket, WalletCards } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { useAppData } from '@/state/app-data';
import { colors, fonts, spacing, textStyles } from '@/theme/tokens';
import type { Order } from '@/types';
import { getOrderActions, getOrderBlockReason, getStatusLabel } from './order-utils';
import { StatusBadge } from './status-badge';

export function OrderCard({ order }: { order: Order }) {
  const { updateOrderStatus } = useAppData();
  const actions = getOrderActions(order); const blockReason = getOrderBlockReason(order);
  return <Card>
    <Pressable accessibilityLabel={`Open order ${order.id}`} accessibilityRole="button" onPress={() => router.push({ pathname: '/(owner)/order/[id]', params: { id: order.id } })}>
      <View style={styles.top}><View style={styles.flex}><View style={styles.idRow}><Text style={styles.id}>#{order.id}</Text><Clock3 color={colors.muted} size={12} /><Text style={styles.elapsed}>{order.elapsed}</Text></View><Text style={styles.customer}>{order.customer}</Text><View style={styles.pickup}><ShoppingBasket color={colors.tertiary} size={15} /><Text style={styles.pickupText}>Pickup Order</Text></View></View><StatusBadge label={getStatusLabel(order.status)} status={order.status} /></View>
      <Text style={styles.sectionLabel}>Items</Text>{order.items.map((item) => <View key={`${item.qty}-${item.name}`} style={styles.itemRow}><Text style={styles.qty}>{item.qty}</Text><Text numberOfLines={1} style={styles.itemName}>{item.name}</Text><Text style={styles.price}>{item.price}</Text></View>)}
      <View style={styles.details}><Text style={styles.sectionLabel}>Order Details</Text><Detail icon={<WalletCards color={colors.muted} size={14} />} label="Payment" value={order.paymentMethod} /><Detail icon={<Clock3 color={colors.muted} size={14} />} label="Pick up time" value={order.preferredTime} />{order.specialRequest ? <Detail icon={<MessageSquareText color={colors.muted} size={14} />} label="Special request" value={order.specialRequest} /> : null}</View>
    </Pressable>
    {blockReason ? <View style={styles.warning}><AlertCircle color={colors.amberDark} size={15} /><Text style={styles.warningText}>Cannot accept: {blockReason}</Text></View> : null}
    <View style={styles.actionRow}><View style={styles.flex}><Text style={styles.totalLabel}>Total Amount</Text><Text style={styles.total}>{order.total}</Text></View>{actions.map((action) => <View key={action.label} style={styles.action}><AppButton compact disabled={action.disabled} label={action.label} onPress={() => updateOrderStatus(order.id, action.nextStatus)} variant={action.variant} /></View>)}</View>
  </Card>;
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <View style={styles.detailRow}>{icon}<Text style={styles.detailText}><Text style={styles.strong}>{label}:</Text> {value}</Text></View>; }

const styles = StyleSheet.create({
  top: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm }, flex: { flex: 1 }, idRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  id: { color: colors.terracotta, fontFamily: fonts.extraBold, fontSize: 12 }, elapsed: { ...textStyles.tiny }, customer: { ...textStyles.headline, color: '#4D3833', marginTop: spacing.sm },
  pickup: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }, pickupText: { color: colors.tertiary, fontFamily: fonts.semiBold, fontSize: 13 },
  sectionLabel: { ...textStyles.label, marginTop: spacing.lg }, itemRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 5 },
  qty: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 13, width: 34 }, itemName: { color: colors.muted, flex: 1, fontFamily: fonts.medium, fontSize: 13 }, price: { color: colors.ink, fontFamily: fonts.semiBold, fontSize: 13 },
  details: { borderBottomColor: colors.line, borderBottomWidth: 1, gap: spacing.sm, paddingBottom: spacing.md }, detailRow: { flexDirection: 'row', gap: spacing.sm }, detailText: { color: colors.muted, flex: 1, fontFamily: fonts.medium, fontSize: 12, lineHeight: 17 }, strong: { color: colors.ink, fontFamily: fonts.extraBold },
  warning: { alignItems: 'flex-start', backgroundColor: colors.amberSoft, borderRadius: 8, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md }, warningText: { color: colors.amberDark, flex: 1, fontFamily: fonts.bold, fontSize: 12, lineHeight: 17 },
  actionRow: { alignItems: 'flex-end', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }, action: { minWidth: 92 }, totalLabel: { ...textStyles.tiny }, total: { color: colors.terracotta, fontFamily: fonts.extraBold, fontSize: 24, lineHeight: 30 },
});
