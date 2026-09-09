import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';

import { AppScreen } from '@/components/layout/app-screen';
import { Card } from '@/components/ui/card';
import { OrderCard } from '@/features/orders/order-card';
import { elapsedRank } from '@/features/orders/order-utils';
import { useAppData } from '@/state/app-data';
import { colors, fonts, radii, spacing, textStyles } from '@/theme/tokens';
import type { OrderStatus } from '@/types';

type Filter = 'All' | OrderStatus;
const tabs: { label: string; filter: Filter }[] = [
  { label: 'All', filter: 'All' }, { label: 'Confirmed', filter: 'Customer-Confirmed / Awaiting Staff Acceptance' },
  { label: 'Accepted', filter: 'Accepted' }, { label: 'Ready', filter: 'Ready' }, { label: 'Completed', filter: 'Completed' },
  { label: 'Rejected', filter: 'Rejected' }, { label: 'Expired', filter: 'Expired' },
];

export default function OrdersScreen() {
  const { orders } = useAppData(); const [filter, setFilter] = useState<Filter>('All');
  const visible = useMemo(() => [...orders].sort((a,b) => elapsedRank(a.elapsed) - elapsedRank(b.elapsed)).filter((order) => filter === 'All' || order.status === filter), [filter, orders]);
  const count = (value: Filter) => value === 'All' ? orders.length : orders.filter((order) => order.status === value).length;
  return <AppScreen contentContainerStyle={styles.content}>
    <ScrollView horizontal contentContainerStyle={styles.tabs} showsHorizontalScrollIndicator={false}>{tabs.map((tab) => { const active = filter === tab.filter; return <Pressable accessibilityRole="button" key={tab.filter} onPress={() => setFilter(tab.filter)} style={[styles.tab, active && styles.activeTab]}><Text style={[styles.tabText, active && styles.activeText]}>{tab.label} ({count(tab.filter)})</Text></Pressable>; })}</ScrollView>
    <View style={styles.list}>{visible.length ? visible.map((order) => <OrderCard key={order.id} order={order} />) : <Card><Text style={textStyles.body}>No orders for this status.</Text></Card>}</View>
  </AppScreen>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 0 }, tabs: { gap: spacing.sm, paddingHorizontal: spacing.lg }, tab: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: radii.pill, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.lg }, activeTab: { backgroundColor: colors.terracotta, borderColor: colors.terracotta }, tabText: { color: colors.muted, fontFamily: fonts.extraBold, fontSize: 14 }, activeText: { color: colors.card }, list: { gap: spacing.lg, paddingHorizontal: spacing.lg },
});
