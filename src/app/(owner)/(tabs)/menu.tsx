import { router } from 'expo-router';
import { PackageCheck, Pencil, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/components/layout/app-screen';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { SearchField } from '@/components/ui/search-field';
import { useAppData } from '@/state/app-data';
import { colors, fonts, radii, spacing, textStyles } from '@/theme/tokens';

export default function MenuScreen() {
  const { menuItems, addMenuItem } = useAppData(); const [query, setQuery] = useState('');
  const visible = useMemo(() => menuItems.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase())), [menuItems, query]);
  const add = () => { const id = addMenuItem(); router.push({ pathname: '/(owner)/menu-item/[id]', params: { id } }); };
  return <AppScreen>
    <SearchField onChangeText={setQuery} placeholder="Search menu" value={query} />
    {visible.map((item) => { const percent = Math.min(100, Math.round((item.allocation / item.allocationLimit) * 100)); const available = item.status === 'Available'; return <Card key={item.id} style={styles.card}>
      <View><Image accessibilityLabel={item.name} source={item.image} style={styles.image} /><View style={styles.priceBadge}><Text style={styles.price}>{item.price}</Text></View></View>
      <View style={styles.body}><Text style={styles.name}>{item.name}</Text><Text numberOfLines={2} style={styles.description}>{item.description}</Text><View style={styles.allocation}><View style={styles.allocationTop}><View style={styles.flex}><View style={styles.iconRow}><PackageCheck color={colors.terracotta} size={15} /><Text style={textStyles.label}>Online allocation</Text></View><Text style={styles.allocationLabel}>{available ? `${item.allocation} of ${item.allocationLimit} available today` : `${item.allocation} of ${item.allocationLimit} held while paused`}</Text></View><Text style={[styles.availability, !available && styles.paused]}>{available ? 'Available' : 'Paused'}</Text></View><View style={styles.track}><View style={[styles.progress, { width: `${percent}%` }, !available && styles.pausedBar]} /></View></View>
      <AppButton compact icon={<Pencil color={colors.terracotta} size={16} />} label="Edit item" onPress={() => router.push({ pathname: '/(owner)/menu-item/[id]', params: { id: item.id } })} variant="ghost" />
      </View></Card>; })}
    {!visible.length ? <Card><Text style={textStyles.body}>No matching menu items.</Text></Card> : null}
    <AppButton icon={<Plus color={colors.card} size={18} />} label="Add Menu Item" onPress={add} />
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', padding: 0 }, image: { height: 144, width: '100%' }, priceBadge: { backgroundColor: colors.card, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 5, position: 'absolute', right: spacing.md, top: spacing.md }, price: { color: colors.terracotta, fontFamily: fonts.extraBold, fontSize: 14 },
  body: { gap: spacing.md, padding: spacing.lg }, name: { ...textStyles.title }, description: { ...textStyles.body, fontSize: 13 }, allocation: { backgroundColor: colors.menuSoft, borderRadius: radii.md, padding: spacing.md }, allocationTop: { flexDirection: 'row', gap: spacing.md }, flex: { flex: 1 }, iconRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, allocationLabel: { ...textStyles.tiny, marginTop: spacing.xs }, availability: { color: colors.terracotta, fontFamily: fonts.extraBold, fontSize: 12 }, paused: { color: colors.muted }, track: { backgroundColor: colors.line, borderRadius: radii.pill, height: 8, marginTop: spacing.md, overflow: 'hidden' }, progress: { backgroundColor: colors.terracotta, borderRadius: radii.pill, height: 8 }, pausedBar: { backgroundColor: '#D8C9C2' },
});
