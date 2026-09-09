import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme/tokens';

type Props = Omit<ComponentProps<typeof Pressable>, 'children' | 'style'> & {
  label: string;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  compact?: boolean;
};

export function AppButton({ label, icon, variant = 'primary', compact, disabled, ...props }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [styles.base, compact && styles.compact, styles[variant], pressed && styles.pressed, disabled && styles.disabled]}
      {...props}
    >
      <View style={styles.content}>{icon}<Text style={[styles.text, styles[`${variant}Text`]]}>{label}</Text></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', borderRadius: radii.md, justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing.lg },
  compact: { minHeight: 42, paddingHorizontal: spacing.md },
  content: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  primary: { backgroundColor: colors.terracotta },
  secondary: { backgroundColor: colors.card, borderColor: '#D7C5BD', borderWidth: 1 },
  ghost: { backgroundColor: '#FFF7F3', borderColor: `${colors.terracotta}33`, borderWidth: 1 },
  danger: { backgroundColor: colors.dangerSoft, borderColor: `${colors.terracotta}55`, borderWidth: 1 },
  text: { fontFamily: fonts.extraBold, fontSize: 14 },
  primaryText: { color: colors.card }, secondaryText: { color: colors.muted },
  ghostText: { color: colors.terracotta }, dangerText: { color: colors.terracotta },
  pressed: { opacity: 0.74 }, disabled: { backgroundColor: '#D8C9C2', opacity: 0.7 },
});
