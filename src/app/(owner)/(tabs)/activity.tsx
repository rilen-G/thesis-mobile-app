import { Bot, CheckCircle2, LockKeyhole, PackageCheck, PauseCircle, Pencil, RotateCw, ShieldCheck, Utensils } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/layout/app-screen';
import { Card } from '@/components/ui/card';
import { activityGroups } from '@/data/activity';
import { colors, fonts, radii, spacing, textStyles } from '@/theme/tokens';
import type { ActivityEntry, ActivityTone } from '@/types';

const icons = { pause: PauseCircle, package: PackageCheck, check: CheckCircle2, lock: LockKeyhole, retry: RotateCw, bot: Bot, edit: Pencil, shield: ShieldCheck, menu: Utensils };
const tones: Record<ActivityTone, { background: string; color: string }> = {
  accepted: { background: '#E6F3EF', color: colors.ready }, updated: { background: colors.amberSoft, color: colors.amberDark },
  sent: { background: colors.amberSoft, color: colors.amberDark }, system: { background: colors.tertiarySoft, color: colors.tertiary },
  warning: { background: colors.dangerSoft, color: colors.terracotta },
};

export default function ActivityScreen() {
  return <AppScreen>{activityGroups.map((group) => <View key={group.day} style={styles.group}><View style={styles.dayRow}><View style={styles.railSpace} /><Text style={styles.day}>{group.day}</Text></View>{group.entries.map((entry) => <Entry entry={entry} key={entry.id} />)}</View>)}</AppScreen>;
}

function Entry({ entry }: { entry: ActivityEntry }) {
  const Icon = icons[entry.icon]; const tone = tones[entry.tone];
  return <View style={styles.entry}><View style={styles.rail}><View style={styles.line} /><View style={[styles.iconRing, { backgroundColor: tone.background }]}><Icon color={tone.color} size={17} strokeWidth={2.4} /></View></View><Card style={styles.card}><View style={styles.top}><Text style={styles.time}>{entry.time}</Text><Text style={[styles.badge, { backgroundColor: tone.background, color: tone.color }]}>{entry.status}</Text></View><Text style={styles.title}>{entry.title}</Text><Text style={styles.detail}>{entry.detail}</Text>{entry.message ? <View style={styles.message}><Text style={styles.messageText}>{entry.message}</Text></View> : null}</Card></View>;
}

const styles = StyleSheet.create({
  group: { gap: spacing.xl }, dayRow: { flexDirection: 'row', gap: spacing.md }, railSpace: { width: 40 }, day: { color: colors.muted, fontFamily: fonts.extraBold, fontSize: 14 }, entry: { alignItems: 'stretch', flexDirection: 'row', gap: spacing.md }, rail: { alignItems: 'center', width: 40 }, line: { backgroundColor: '#E5B9AD', bottom: -spacing.xl, position: 'absolute', top: -spacing.xl, width: 2 }, iconRing: { alignItems: 'center', borderColor: colors.cream, borderRadius: 22, borderWidth: 6, height: 44, justifyContent: 'center', marginTop: spacing.lg, width: 44 },
  card: { flex: 1 }, top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, time: { color: colors.ink, fontFamily: fonts.semiBold, fontSize: 12 }, badge: { borderRadius: radii.pill, fontFamily: fonts.semiBold, fontSize: 12, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5 }, title: { ...textStyles.title, marginTop: spacing.md }, detail: { ...textStyles.body, marginTop: spacing.xs }, message: { backgroundColor: `${colors.terracottaSoft}77`, borderColor: colors.terracottaSoft, borderRadius: radii.sm, borderWidth: 1, marginTop: spacing.lg, padding: spacing.md }, messageText: { color: colors.terracottaDark, fontFamily: fonts.semiBold, fontSize: 13, fontStyle: 'italic', lineHeight: 19 },
});
