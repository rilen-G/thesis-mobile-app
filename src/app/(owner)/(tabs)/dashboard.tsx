import { router } from 'expo-router';
import { AlertCircle, Banknote, CheckCircle2, ClipboardPenLine, Megaphone, MessageSquareText, Sparkles, UtensilsCrossed } from 'lucide-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/layout/app-screen';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { useAppData } from '@/state/app-data';
import { colors, fonts, radii, spacing, textStyles } from '@/theme/tokens';

const metrics = [
  { icon: CheckCircle2, label: 'Completed Online Orders Today', value: '18' },
  { icon: AlertCircle, label: 'Orders Needing Action', value: '3' },
  { icon: MessageSquareText, label: 'New Order-Related Conversations', value: '5' },
  { icon: Megaphone, label: 'Latest Promotional Post Reach', value: '1.2k' },
];

export default function DashboardScreen() {
  const { promotions } = useAppData();
  const activeDrafts = promotions.filter((draft) => draft.status !== 'Published').length;
  return (
    <AppScreen>
      <View><Text style={textStyles.title}>Magandang araw!</Text><Text style={styles.sub}>Here&apos;s your store&apos;s performance today.</Text></View>
      <Card style={styles.largeCard}><View style={styles.iconLabel}><Banknote color={colors.terracotta} size={22} /><Text style={textStyles.label}>End-of-Day Online Sales</Text></View><Text style={textStyles.display}>₱4,520.00</Text></Card>
      <View style={styles.grid}>{metrics.map(({ icon: Icon, label, value }) => <Card key={label} style={styles.metric}><View style={styles.metricTop}><Icon color={colors.terracotta} size={22} /><Text style={styles.metricLabel}>{label}</Text></View><Text style={styles.metricValue}>{value}</Text></Card>)}</View>
      <Card style={styles.largeCard}><View style={styles.iconLabel}><ClipboardPenLine color={colors.terracotta} size={22} /><Text style={[textStyles.label, styles.primary]}>Promo Review Queue</Text></View><View><Text style={textStyles.title}>{activeDrafts} drafts need attention</Text><Text style={styles.small}>Next: <Text style={styles.strong}>Wednesday, 11:00 AM</Text> — Pork Adobo Bowl</Text></View></Card>
      <Card style={styles.topItem}><View style={styles.flex}><View style={styles.iconLabel}><UtensilsCrossed color={colors.terracotta} size={22} /><Text style={textStyles.label}>Top Ordered Item</Text></View><Text style={[textStyles.title, styles.itemName]}>Chicken Pastil</Text><Text style={styles.small}>Based on completed Messenger orders.</Text></View><Image source={require('../../../../assets/food/pastil.jpg')} style={styles.food} /></Card>
      <Card style={styles.candidate}><View style={styles.iconLabel}><Sparkles color={colors.amberDark} size={18} /><Text style={[textStyles.label, styles.amber]}>Promotion Candidate</Text></View><Text style={styles.candidateText}><Text style={styles.strong}>Chicken Pastil</Text> is suggested from completed online-order performance and current availability. Owner or authorized staff still selects the item before a draft is generated.</Text></Card>
      <AppButton label="View Owner KPI Analytics" onPress={() => router.push('/(owner)/metrics')} variant="ghost" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  sub: { ...textStyles.body, marginTop: spacing.xs }, largeCard: { justifyContent: 'space-between', minHeight: 112 },
  iconLabel: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, primary: { color: colors.terracotta },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, metric: { justifyContent: 'space-between', minHeight: 112, width: '48%' },
  metricTop: { flexDirection: 'row', gap: spacing.sm }, metricLabel: { ...textStyles.label, flex: 1 }, metricValue: { ...textStyles.headline, marginTop: spacing.md },
  small: { ...textStyles.tiny, marginTop: spacing.xs }, strong: { color: colors.ink, fontFamily: fonts.extraBold },
  topItem: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 112 }, flex: { flex: 1 }, itemName: { marginTop: spacing.sm },
  food: { borderRadius: radii.md, height: 62, width: 70 }, candidate: { backgroundColor: colors.amberSoft, borderColor: `${colors.amber}88` },
  amber: { color: colors.amberDark }, candidateText: { ...textStyles.body, color: '#5A4036', marginTop: spacing.md },
});
