import { useLocalSearchParams } from 'expo-router';
import { Alert, Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { AlertCircle, Camera, Minus, PackageCheck, Plus, Save } from 'lucide-react-native';
import { useState } from 'react';

import { AppScreen } from '@/components/layout/app-screen';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { useAppData } from '@/state/app-data';
import { colors, fonts, radii, spacing, textStyles } from '@/theme/tokens';

export default function MenuItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { menuItems, updateMenuItem } = useAppData(); const item = menuItems.find((value) => value.id === id);
  const [name, setName] = useState(item?.name ?? ''); const [price, setPrice] = useState(item?.price ?? ''); const [description, setDescription] = useState(item?.description ?? '');
  const [allocation, setAllocation] = useState(item?.allocation ?? 0); const [available, setAvailable] = useState(item?.status === 'Available');
  if (!item) return <AppScreen detail hideSettings title="Edit Menu Item"><Card><Text style={textStyles.body}>Menu item not found.</Text></Card></AppScreen>;
  const percent = Math.min(100, Math.round((allocation / item.allocationLimit) * 100));
  const save = () => { updateMenuItem(item.id, { name, price, description, allocation, status: available ? 'Available' : 'Temporarily unavailable' }); Alert.alert('Saved', 'Menu item changes are stored for this prototype session.'); };
  return <AppScreen backLabel="Back to menu" detail title="Edit Menu Item">
    <Card><View><Image source={item.image} style={styles.image} /><View style={styles.priceBadge}><Text style={styles.price}>{price}</Text></View></View><AppButton compact icon={<Camera color={colors.muted} size={17} />} label="Change Food Photo" onPress={() => Alert.alert('Photo picker', 'Photo selection will connect to Expo Image Picker in the Supabase menu vertical slice.')} variant="secondary" /></Card>
    <Card style={styles.form}><FormField label="Menu name" onChangeText={setName} value={name} /><FormField inputMode="decimal" label="Price" onChangeText={setPrice} value={price} /><FormField label="Description" multiline onChangeText={setDescription} value={description} /></Card>
    <Card style={styles.form}><View style={styles.availabilityRow}><View style={styles.iconRow}><PackageCheck color={colors.terracotta} size={18} /><Text style={styles.section}>Online availability</Text></View><View style={styles.switchRow}><Text style={[styles.state, !available && styles.paused]}>{available ? 'Available' : 'Paused'}</Text><Switch accessibilityLabel={available ? 'Pause chat orders for this item' : 'Resume chat orders for this item'} onValueChange={setAvailable} thumbColor={colors.card} trackColor={{ false: '#D8C9C2', true: colors.terracotta }} value={available} /></View></View>
      {!available ? <View style={styles.warning}><AlertCircle color={colors.muted} size={15} /><Text style={styles.warningText}>Unavailable items are not suggested in chat orders or selected for pending promotional publications.</Text></View> : null}
      <View style={styles.allocation}><View style={styles.allocationTop}><View style={styles.flex}><Text style={textStyles.label}>Online allocation</Text><Text style={textStyles.tiny}>{item.allocationUpdatedAt}</Text></View><View style={styles.stepper}><Pressable accessibilityLabel="Decrease allocation" onPress={() => setAllocation((value) => Math.max(0, value - 1))} style={styles.step}><Minus color={colors.muted} size={16} /></Pressable><Text style={styles.count}>{allocation}</Text><Pressable accessibilityLabel="Increase allocation" onPress={() => setAllocation((value) => Math.min(item.allocationLimit, value + 1))} style={[styles.step, styles.add]}><Plus color={colors.card} size={16} /></Pressable></View></View><View style={styles.track}><View style={[styles.progress, { width: `${percent}%` }, !available && styles.pausedBar]} /></View></View>
    </Card>
    <AppButton icon={<Save color={colors.card} size={18} />} label="Save Menu Item" onPress={save} />
  </AppScreen>;
}

const styles = StyleSheet.create({
  image: { borderRadius: radii.md, height: 176, width: '100%' }, priceBadge: { backgroundColor: colors.card, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 5, position: 'absolute', right: spacing.md, top: spacing.md }, price: { color: colors.terracotta, fontFamily: fonts.extraBold, fontSize: 14 }, form: { gap: spacing.md },
  availabilityRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, iconRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, section: { ...textStyles.label, fontSize: 14 }, switchRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm }, state: { color: colors.terracotta, fontFamily: fonts.extraBold, fontSize: 13 }, paused: { color: colors.muted },
  warning: { alignItems: 'flex-start', backgroundColor: colors.neutralSoft, borderRadius: radii.md, flexDirection: 'row', gap: spacing.sm, padding: spacing.md }, warningText: { ...textStyles.tiny, flex: 1 }, allocation: { backgroundColor: colors.menuSoft, borderRadius: radii.md, padding: spacing.md }, allocationTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.md }, flex: { flex: 1 }, stepper: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', overflow: 'hidden' }, step: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 }, count: { borderLeftColor: colors.line, borderLeftWidth: 1, borderRightColor: colors.line, borderRightWidth: 1, color: colors.terracotta, fontFamily: fonts.extraBold, minWidth: 48, paddingVertical: 12, textAlign: 'center' }, add: { backgroundColor: colors.terracotta }, track: { backgroundColor: colors.line, borderRadius: radii.pill, height: 8, marginTop: spacing.md, overflow: 'hidden' }, progress: { backgroundColor: colors.terracotta, borderRadius: radii.pill, height: 8 }, pausedBar: { backgroundColor: '#D8C9C2' },
});
