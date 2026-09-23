import type { ComponentProps } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme/tokens';

type Props = ComponentProps<typeof TextInput> & { label: string };

export function FormField({ label, multiline, style, ...props }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        multiline={multiline}
        placeholderTextColor={colors.subtleText}
        style={[styles.input, multiline && styles.multiline, style]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { color: colors.ink, fontFamily: fonts.extraBold, fontSize: 12, lineHeight: 16 },
  input: { backgroundColor: '#FFFAF4', borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, color: colors.ink, fontFamily: fonts.semiBold, fontSize: 15, minHeight: 48, paddingHorizontal: spacing.md },
  multiline: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
});
