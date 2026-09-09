import { Search } from 'lucide-react-native';
import { StyleSheet, TextInput, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme/tokens';

export function SearchField({ value, onChangeText, placeholder }: { value: string; onChangeText: (value: string) => void; placeholder: string }) {
  return (
    <View style={styles.wrap}>
      <Search color={colors.muted} size={20} strokeWidth={2.3} />
      <TextInput accessibilityLabel={placeholder} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.subtleText} style={styles.input} value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', backgroundColor: colors.card, borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 48, paddingHorizontal: spacing.md },
  input: { color: colors.ink, flex: 1, fontFamily: fonts.semiBold, fontSize: 16 },
});
