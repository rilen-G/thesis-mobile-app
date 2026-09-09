import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii, spacing } from '@/theme/tokens';
import type { OrderStatus } from '@/types';

const tones: Record<OrderStatus, { backgroundColor: string; color: string }> = {
  'Customer-Confirmed / Awaiting Staff Acceptance': { backgroundColor: colors.tertiarySoft, color: colors.tertiary },
  Rejected: { backgroundColor: colors.neutralSoft, color: colors.muted },
  Accepted: { backgroundColor: colors.terracottaSoft, color: colors.terracotta },
  Preparing: { backgroundColor: '#FFF2DF', color: colors.preparing },
  Ready: { backgroundColor: colors.readySoft, color: colors.ready },
  Completed: { backgroundColor: colors.readySoft, color: colors.ready },
  Cancelled: { backgroundColor: colors.neutralSoft, color: colors.muted },
  Expired: { backgroundColor: colors.neutralSoft, color: colors.muted },
};

export function StatusBadge({ status, label }: { status: OrderStatus; label?: string }) {
  const tone = tones[status];
  return <View style={[styles.badge, { backgroundColor: tone.backgroundColor }]}><Text numberOfLines={1} style={[styles.text, { color: tone.color }]}>{label ?? status}</Text></View>;
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', borderRadius: radii.pill, justifyContent: 'center', minHeight: 28, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  text: { fontFamily: fonts.extraBold, fontSize: 11, lineHeight: 14 },
});
