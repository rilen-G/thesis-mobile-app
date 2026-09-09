import { router } from 'expo-router';
import { BellRing, CalendarClock, Check, CheckCircle2, ChevronRight, Clock3, Contact, FileText, Languages, LogOut, Mail, Megaphone, PackageCheck, Phone, ShieldCheck, Store, UsersRound } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/layout/app-screen';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { permissionExamples } from '@/data/permissions';
import { useAppData } from '@/state/app-data';
import { colors, fonts, radii, spacing, textStyles } from '@/theme/tokens';

const formats = ['Text only', 'AI template plus text', 'Use original photo and text', 'Upload'];
const descriptions: Record<string, string> = { 'Text only': 'Caption without generated visuals', 'AI template plus text': 'Generated template with caption', 'Use original photo and text': 'Existing food photo with caption', Upload: 'Manual photo or creative upload' };

export default function SettingsScreen() {
  const [formatView, setFormatView] = useState(false); const { defaultPostFormat, setDefaultPostFormat } = useAppData();
  if (formatView) return <AppScreen backLabel="Back to settings" detail hideSettings title="Default Post Format">
    <Section title="Default Post Format"><Card style={styles.flush}>{formats.map((option, index) => <Pressable key={option} onPress={() => setDefaultPostFormat(option)} style={[styles.format, index > 0 && styles.divider]}><View style={styles.iconCircle}><FileText color={colors.terracotta} size={20} /></View><View style={styles.flex}><Text style={styles.rowTitle}>{option}</Text><Text style={styles.rowDetail}>{descriptions[option]}</Text></View>{defaultPostFormat === option ? <Check color={colors.terracotta} size={20} /> : null}</Pressable>)}</Card><AppButton label="Back to AI Assistant" onPress={() => setFormatView(false)} variant="secondary" /></Section>
  </AppScreen>;
  return <AppScreen backLabel="Back" detail hideSettings title="Settings">
    <Section title="General"><SettingsCard rows={[
      { icon: Store, title: 'Business Info', detail: "Lola's Eatery, Quezon City" }, { icon: Clock3, title: 'Operating Hours', detail: '8:00 AM - 10:00 PM' }, { icon: CalendarClock, title: 'Daily Cut-Off Time', detail: '10:00 PM for end-of-day online sales' },
    ]} /></Section>
    <Section title="Integrations"><SettingsCard rows={[{ icon: Megaphone, title: 'Facebook Page', detail: 'Connected', connected: true }, { icon: BellRing, title: 'Messenger Webhook', detail: 'Receives and stores Page messages', connected: true }]} /></Section>
    <Section title="AI Assistant ✦"><SettingsCard rows={[{ icon: Languages, title: 'AI Language', detail: 'Taglish' }, { icon: FileText, title: 'Default Post Format', detail: defaultPostFormat, onPress: () => setFormatView(true) }]} /></Section>
    <Section title="Team"><Card style={styles.flush}><SettingsRow icon={UsersRound} title="Staff Permissions" detail="Manage non-default staff access" />{permissionExamples.map((permission) => <View key={permission.action} style={styles.permission}><ShieldCheck color={colors.terracotta} size={18} /><View style={styles.flex}><Text style={styles.permissionTitle}>{permission.action}</Text><Text style={styles.permissionDetail}>{permission.authorizedStaff}</Text></View></View>)}</Card></Section>
    <Section title="Menu Capacity"><SettingsCard rows={[{ icon: PackageCheck, title: 'Daily Online Allocation', detail: 'Reset manually before opening' }, { icon: PackageCheck, title: 'Unavailable Items', detail: 'Not suggested, ordered, or promoted' }]} /></Section>
    <Section title="Contact Us"><SettingsCard rows={[{ icon: Contact, title: 'Researchers / Developers', detail: 'Contact for app setup or technical errors' }, { icon: Mail, title: 'Email', detail: 'To be provided' }, { icon: Phone, title: 'Phone / Messenger', detail: 'To be provided' }]} /></Section>
    <AppButton icon={<LogOut color={colors.terracotta} size={18} />} label="Sign Out" onPress={() => router.replace('/(auth)/sign-in')} variant="danger" />
  </AppScreen>;
}

type IconType = typeof Store;
type Row = { icon: IconType; title: string; detail: string; connected?: boolean; onPress?: () => void };
function Section({ title, children }: { title: string; children: ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }
function SettingsCard({ rows }: { rows: Row[] }) { return <Card style={styles.flush}>{rows.map((row, index) => <View key={row.title} style={index > 0 ? styles.divider : undefined}><SettingsRow {...row} /></View>)}</Card>; }
function SettingsRow({ icon: Icon, title, detail, connected, onPress }: Row) { const content = <><View style={styles.iconCircle}><Icon color={colors.terracotta} size={20} /></View><View style={styles.flex}><Text style={styles.rowTitle}>{title}</Text><View style={styles.connectedRow}>{connected ? <CheckCircle2 color={colors.ready} size={13} /> : null}<Text style={[styles.rowDetail, connected && styles.connected]}>{detail}</Text></View></View><ChevronRight color={colors.muted} size={20} /></>; return onPress ? <Pressable onPress={onPress} style={styles.row}>{content}</Pressable> : <View style={styles.row}>{content}</View>; }

const styles = StyleSheet.create({
  section: { gap: spacing.md }, sectionTitle: { ...textStyles.title, fontSize: 16 }, flush: { overflow: 'hidden', padding: 0 }, divider: { borderTopColor: colors.line, borderTopWidth: 1 }, row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 72, padding: spacing.lg }, iconCircle: { alignItems: 'center', backgroundColor: colors.terracottaSoft, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 }, flex: { flex: 1 }, rowTitle: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 14 }, rowDetail: { color: colors.muted, flexShrink: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 17 }, connected: { color: colors.ready }, connectedRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs }, permission: { alignItems: 'flex-start', backgroundColor: colors.cream, borderRadius: radii.sm, flexDirection: 'row', gap: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.md }, permissionTitle: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 12 }, permissionDetail: { ...textStyles.tiny, marginTop: spacing.xs }, format: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 72, padding: spacing.lg },
});
