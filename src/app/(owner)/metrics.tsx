import { BarChart3, Link2, MessageSquarePlus, Percent, Reply, TrendingUp, UtensilsCrossed } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/layout/app-screen';
import { Card } from '@/components/ui/card';
import { colors, fonts, spacing, textStyles } from '@/theme/tokens';

const metrics = [
  { label: 'Avg. Promotional-Post Reach', value: '1.2k avg', note: 'Testing average compared with 30-day baseline.', icon: TrendingUp },
  { label: 'New Order-Related Conversations', value: '5/day', note: 'Distinct new Messenger threads about ordering.', icon: MessageSquarePlus },
  { label: 'Chat-to-Sale Conversion Rate', value: '56%', note: 'Completed chat orders divided by order-related conversations.', icon: Percent },
  { label: 'Promotion-to-Chat Conversion Rate', value: '4.8%', note: 'Tracked referral conversations divided by post reach.', icon: Link2 },
  { label: 'Follow-Up Response Rate', value: '18%', note: 'Eligible stalled chats completed after one app follow-up.', icon: Reply, wide: true },
];

export default function MetricsScreen() {
  return <AppScreen backLabel="Back to dashboard" detail hideSettings title="KPI Analytics">
    <Card style={styles.intro}><View style={styles.row}><BarChart3 color={colors.terracotta} size={22} /><Text style={textStyles.label}>KPI Analytics</Text></View><Text style={styles.note}>Values are placeholder readings. Final results compare the testing period with the 30-day pre-app baseline where a valid baseline exists.</Text></Card>
    <View style={styles.grid}>{metrics.map(({ icon: Icon, ...metric }) => <Card key={metric.label} style={[styles.metric, metric.wide && styles.wide]}><View style={styles.row}><Icon color={colors.terracotta} size={22} /><Text style={styles.label}>{metric.label}</Text></View><Text style={styles.value}>{metric.value}</Text><Text style={styles.note}>{metric.note}</Text></Card>)}</View>
    <Card><View style={styles.row}><UtensilsCrossed color={colors.terracotta} size={22} /><Text style={textStyles.label}>Menu-Item Order Performance</Text></View><Text style={styles.note}>Completed Messenger-order quantity and completed online sales amount from June 1 to June 14.</Text>{[['Chicken Pastil','18 sold','₱1,710'],['Pork Adobo Bowl','9 sold','₱1,125'],['Leche Flan Cup','7 sold','₱875']].map(([item, sold, sales]) => <View key={item} style={styles.performance}><View style={styles.flex}><Text style={styles.item}>{item}</Text><Text style={styles.note}>{sold}</Text></View><Text style={styles.sales}>{sales}</Text></View>)}</Card>
  </AppScreen>;
}

const styles = StyleSheet.create({
  intro: { backgroundColor: '#FFFAF4' }, row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, note: { ...textStyles.tiny, marginTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }, metric: { minHeight: 136, width: '48%' }, wide: { minHeight: 112, width: '100%' },
  label: { ...textStyles.label, flex: 1 }, value: { ...textStyles.headline, marginTop: spacing.md }, performance: { alignItems: 'center', backgroundColor: colors.menuSoft, borderRadius: 8, flexDirection: 'row', marginTop: spacing.sm, padding: spacing.md },
  flex: { flex: 1 }, item: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 14 }, sales: { color: colors.terracotta, fontFamily: fonts.extraBold, fontSize: 14 },
});
