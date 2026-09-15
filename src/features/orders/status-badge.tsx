import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme/tokens';
import type { Status } from '@/features/operations/domain';

const tones: Record<Status, { backgroundColor: string; borderColor: string; color: string }> = {
  confirmed: { backgroundColor: colors.tertiarySoft, borderColor: '#C5DFE9', color: colors.tertiary },
  rejected: { backgroundColor: colors.neutralSoft, borderColor: colors.line, color: colors.muted },
  accepted: { backgroundColor: colors.terracottaSoft, borderColor: '#EFB8AE', color: colors.terracotta },
  ready: { backgroundColor: colors.readySoft, borderColor: '#C6E1D7', color: colors.ready },
  completed: { backgroundColor: colors.readySoft, borderColor: '#C6E1D7', color: colors.ready },
  expired: { backgroundColor: colors.neutralSoft, borderColor: colors.line, color: colors.muted },
};

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const tone = tones[status];
  return <View style={[styles.badge, { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor }]}><Text numberOfLines={1} style={[styles.text, { color: tone.color }]}>{label ?? status}</Text></View>;
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', borderRadius: radii.pill, borderWidth: 1, justifyContent: 'center', minHeight: 28, paddingHorizontal: 10, paddingVertical: spacing.xs },
  text: { fontFamily: fonts.extraBold, fontSize: 11, lineHeight: 14 },
});
