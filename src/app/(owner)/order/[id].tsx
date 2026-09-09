import { useLocalSearchParams } from 'expo-router';
import { AlertCircle, Clock3, MessageSquareText, Pencil, Save, ShoppingBasket, WalletCards, X } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/layout/app-screen';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { getOrderActions, getOrderBlockReason, getStatusLabel } from '@/features/orders/order-utils';
import { StatusBadge } from '@/features/orders/status-badge';
import { useAppData } from '@/state/app-data';
import { colors, fonts, radii, spacing, textStyles } from '@/theme/tokens';

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders, customers, updateOrder, updateOrderStatus } = useAppData();
  const order = useMemo(() => orders.find((item) => item.id === id) ?? customers.flatMap((customer) => customer.purchaseHistory).find((item) => item.id === id), [customers, id, orders]);
  const [editing, setEditing] = useState(false);
  const [customer, setCustomer] = useState(order?.customer ?? ''); const [payment, setPayment] = useState(order?.paymentMethod ?? '');
  const [pickup, setPickup] = useState(order?.preferredTime ?? ''); const [request, setRequest] = useState(order?.specialRequest ?? '');
  if (!order) return <AppScreen detail hideSettings title="Order Details"><Card><Text style={textStyles.body}>Order not found.</Text></Card></AppScreen>;
  const actions = getOrderActions(order); const blockReason = getOrderBlockReason(order);
  const save = () => { updateOrder(order.id, { customer, paymentMethod: payment, preferredTime: pickup, specialRequest: request }); setEditing(false); };
  return <AppScreen backLabel="Back to orders" detail title="Order Details">
    <Card>
      <View style={styles.top}><View style={styles.flex}><View style={styles.idRow}><Text style={styles.id}>#{order.id}</Text><Clock3 color={colors.muted} size={12} /><Text style={textStyles.tiny}>{order.elapsed}</Text></View><Text style={styles.customer}>{order.customer}</Text><View style={styles.pickup}><ShoppingBasket color={colors.tertiary} size={15} /><Text style={styles.pickupText}>Pickup Order</Text></View></View><StatusBadge label={getStatusLabel(order.status)} status={order.status} /></View>
      <AppButton compact icon={editing ? <X color={colors.terracotta} size={17} /> : <Pencil color={colors.terracotta} size={17} />} label={editing ? 'Cancel editing' : 'Edit order'} onPress={() => setEditing((value) => !value)} variant="ghost" />
      <Text style={styles.section}>Items</Text>{order.items.map((item) => <View key={`${item.qty}-${item.name}`} style={styles.item}><Text style={styles.qty}>{item.qty}</Text><Text style={styles.itemName}>{item.name}</Text><Text style={styles.itemPrice}>{item.price}</Text></View>)}
      {editing ? <View style={styles.form}><Text style={styles.sectionNoMargin}>Edit Order Details</Text><FormField label="Customer name" onChangeText={setCustomer} value={customer} /><FormField label="Payment method" onChangeText={setPayment} value={payment} /><FormField label="Pickup time" onChangeText={setPickup} value={pickup} /><FormField label="Special request" onChangeText={setRequest} value={request} /><AppButton icon={<Save color={colors.card} size={17} />} label="Save changes" onPress={save} /></View> : <View style={styles.details}><Text style={styles.sectionNoMargin}>Order Details</Text><Detail icon={<WalletCards color={colors.muted} size={14} />} label="Payment" value={order.paymentMethod} /><Detail icon={<Clock3 color={colors.muted} size={14} />} label="Pick up time" value={order.preferredTime} />{order.specialRequest ? <Detail icon={<MessageSquareText color={colors.muted} size={14} />} label="Special request" value={order.specialRequest} /> : null}</View>}
      {blockReason ? <View style={styles.warning}><AlertCircle color={colors.amberDark} size={15} /><Text style={styles.warningText}>Cannot accept: {blockReason}</Text></View> : null}
      <View style={styles.actions}><View style={styles.flex}><Text style={textStyles.tiny}>Total Amount</Text><Text style={styles.total}>{order.total}</Text></View>{actions.map((action) => <AppButton compact disabled={action.disabled} key={action.label} label={action.label} onPress={() => updateOrderStatus(order.id, action.nextStatus)} variant={action.variant} />)}</View>
    </Card>
    {(order.correctionNote || order.cancellationRequest || order.rejectionReason || order.followUp) ? <Card style={styles.context}><Text style={styles.sectionNoMargin}>Workflow context</Text>{order.correctionNote ? <Context label="Correction" value={order.correctionNote} /> : null}{order.cancellationRequest ? <Context label="Cancellation" value={order.cancellationRequest} /> : null}{order.rejectionReason ? <Context label="Rejection" value={order.rejectionReason} /> : null}<Context label="Follow-up" value={order.followUp} /><Context label="Current action" value={order.actionState} /></Card> : null}
    <Card><View style={styles.snapshotTitle}><MessageSquareText color={colors.terracotta} size={19} /><Text style={styles.sectionNoMargin}>Messenger Snapshot</Text></View>{order.conversation.map((message) => <View key={`${message.time}-${message.text}`} style={[styles.message, message.sender === 'AI' ? styles.ai : message.sender === 'Customer' ? styles.customerMessage : styles.business]}><Text style={styles.messageText}><Text style={styles.messageAuthor}>{message.sender}</Text> at {message.time}: {message.text}</Text></View>)}</Card>
  </AppScreen>;
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <View style={styles.detailRow}>{icon}<Text style={styles.detailText}><Text style={styles.bold}>{label}:</Text> {value}</Text></View>; }
function Context({ label, value }: { label: string; value: string }) { return <Text style={styles.contextText}><Text style={styles.bold}>{label}:</Text> {value}</Text>; }

const styles = StyleSheet.create({
  top: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }, flex: { flex: 1 }, idRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs }, id: { color: colors.terracotta, fontFamily: fonts.extraBold, fontSize: 12 },
  customer: { ...textStyles.headline, color: '#4D3833', marginTop: spacing.sm }, pickup: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }, pickupText: { color: colors.tertiary, fontFamily: fonts.semiBold, fontSize: 13 },
  section: { ...textStyles.label, marginTop: spacing.lg }, sectionNoMargin: { ...textStyles.label }, item: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 5 }, qty: { color: colors.ink, fontFamily: fonts.extraBold, width: 38 }, itemName: { color: colors.muted, flex: 1, fontFamily: fonts.medium }, itemPrice: { color: colors.ink, fontFamily: fonts.semiBold },
  form: { borderBottomColor: colors.line, borderBottomWidth: 1, gap: spacing.md, marginTop: spacing.md, paddingBottom: spacing.lg }, details: { borderBottomColor: colors.line, borderBottomWidth: 1, gap: spacing.sm, marginTop: spacing.md, paddingBottom: spacing.md }, detailRow: { flexDirection: 'row', gap: spacing.sm }, detailText: { ...textStyles.tiny, flex: 1 }, bold: { color: colors.ink, fontFamily: fonts.extraBold },
  warning: { backgroundColor: colors.amberSoft, borderRadius: radii.md, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md }, warningText: { color: colors.amberDark, flex: 1, fontFamily: fonts.bold, fontSize: 12, lineHeight: 17 }, actions: { alignItems: 'flex-end', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }, total: { color: colors.terracotta, fontFamily: fonts.extraBold, fontSize: 24 },
  context: { backgroundColor: colors.menuSoft, gap: spacing.sm }, contextText: { ...textStyles.tiny }, snapshotTitle: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }, message: { borderRadius: radii.md, marginTop: spacing.sm, padding: spacing.md }, ai: { backgroundColor: colors.readySoft }, customerMessage: { backgroundColor: '#FFF8ED' }, business: { backgroundColor: colors.dangerSoft }, messageText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, lineHeight: 17 }, messageAuthor: { color: colors.ink, fontFamily: fonts.extraBold },
});
