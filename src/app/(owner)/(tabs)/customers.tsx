import { router } from 'expo-router';
import { CalendarDays, ChevronRight, MessageCircle, ShoppingBag, Tag } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/layout/app-screen';
import { Card } from '@/components/ui/card';
import { SearchField } from '@/components/ui/search-field';
import { useAppData } from '@/state/app-data';
import { colors, fonts, radii, spacing, textStyles } from '@/theme/tokens';
import type { CustomerSegment } from '@/types';

type Filter = 'All' | CustomerSegment;

export default function CustomersScreen() {
  const { customers } = useAppData(); const [query, setQuery] = useState(''); const [filter, setFilter] = useState<Filter>('All');
  const visible = useMemo(() => { const normalized = query.trim().toLowerCase(); return customers.filter((customer) => (filter === 'All' || customer.segment === filter) && (!normalized || customer.name.toLowerCase().includes(normalized))); }, [customers, filter, query]);
  return <AppScreen>
    <SearchField onChangeText={setQuery} placeholder="Search customers" value={query} />
    <Card style={styles.summary}><Text style={textStyles.label}>Customer overview</Text><View style={styles.metrics}><Metric label="Customers" value="24" /><Metric bordered label="Returning" value="8" /><Metric label="New this month" value="5" /></View></Card>
    <ScrollView horizontal contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false}>{(['All','Returning','New'] as Filter[]).map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && styles.activeFilter]}><Text style={[styles.filterText, filter === item && styles.activeFilterText]}>{item}</Text></Pressable>)}</ScrollView>
    {visible.length ? visible.map((customer) => <Pressable accessibilityRole="button" key={customer.id} onPress={() => router.push({ pathname: '/(owner)/customer/[id]', params: { id: customer.id } })}><Card style={styles.customerCard}><View style={styles.avatar}><Text style={styles.initials}>{customer.initials}</Text><View style={styles.messenger}><MessageCircle color={colors.card} fill={colors.card} size={13} /></View></View><View style={styles.flex}><View style={styles.nameRow}><Text numberOfLines={1} style={styles.name}>{customer.name}</Text><Text style={[styles.segment, customer.segment === 'Returning' ? styles.returning : styles.new]}>{customer.segment}</Text></View><View style={styles.detail}><ShoppingBag color={colors.muted} size={14} /><Text style={styles.detailText}>{customer.orders} orders</Text></View><View style={styles.detail}><CalendarDays color={colors.muted} size={14} /><Text style={styles.detailText}>Last order: {customer.lastOrder}</Text></View><View style={styles.detail}><Tag color={colors.muted} size={14} /><Text style={styles.detailText}>Total spent: <Text style={styles.spent}>{customer.totalSpent}</Text></Text></View></View><ChevronRight color={colors.muted} size={20} /></Card></Pressable>) : <Card><Text style={textStyles.label}>No matching customers</Text><Text style={styles.empty}>Try another name or customer filter.</Text></Card>}
  </AppScreen>;
}

function Metric({ value, label, bordered }: { value: string; label: string; bordered?: boolean }) { return <View style={[styles.metric, bordered && styles.bordered]}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  summary: { padding: spacing.md }, metrics: { flexDirection: 'row', marginTop: spacing.md }, metric: { flex: 1, paddingHorizontal: spacing.sm }, bordered: { borderLeftColor: colors.line, borderLeftWidth: 1, borderRightColor: colors.line, borderRightWidth: 1 }, metricValue: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 20 }, metricLabel: { ...textStyles.tiny, fontSize: 10 },
  filters: { gap: spacing.sm }, filter: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: radii.pill, borderWidth: 1, justifyContent: 'center', minHeight: 44, paddingHorizontal: spacing.xl }, activeFilter: { backgroundColor: colors.terracotta, borderColor: colors.terracotta }, filterText: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 14 }, activeFilterText: { color: colors.card },
  customerCard: { alignItems: 'center', flexDirection: 'row', gap: spacing.md }, avatar: { alignItems: 'center', backgroundColor: '#F3EDE3', borderRadius: 28, height: 56, justifyContent: 'center', width: 56 }, initials: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 18 }, messenger: { alignItems: 'center', backgroundColor: colors.messenger, borderColor: colors.card, borderRadius: 12, borderWidth: 2, bottom: -4, height: 24, justifyContent: 'center', position: 'absolute', right: -4, width: 24 },
  flex: { flex: 1 }, nameRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, name: { color: colors.ink, flexShrink: 1, fontFamily: fonts.extraBold, fontSize: 17 }, segment: { borderRadius: radii.sm, fontFamily: fonts.extraBold, fontSize: 10, overflow: 'hidden', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }, returning: { backgroundColor: colors.amberSoft, color: colors.amberDark }, new: { backgroundColor: colors.terracottaSoft, color: colors.terracottaDark }, detail: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }, detailText: { ...textStyles.tiny, flex: 1 }, spent: { color: colors.terracotta, fontFamily: fonts.extraBold }, empty: { ...textStyles.body, marginTop: spacing.xs },
});
