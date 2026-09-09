import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { cardShadow, colors, radii, spacing } from '@/theme/tokens';

export function Card({ style, ...props }: ComponentProps<typeof View>) {
  return <View style={[styles.card, style]} {...props} />;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderColor: colors.line, borderRadius: radii.md, borderWidth: 1, padding: spacing.lg, ...cardShadow },
});
