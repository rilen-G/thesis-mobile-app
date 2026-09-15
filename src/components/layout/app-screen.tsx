import { router } from 'expo-router';
import { ArrowLeft, Settings } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, spacing } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  title?: string;
  detail?: boolean;
  backLabel?: string;
  hideSettings?: boolean;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
};

export function AppScreen({ children, title = 'Partner Business', detail, backLabel = 'Back', hideSettings, contentContainerStyle }: Props) {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        {detail ? (
          <Pressable accessibilityLabel={backLabel} accessibilityRole="button" hitSlop={10} onPress={() => router.back()} style={styles.iconButton}>
            <ArrowLeft color={colors.ink} size={22} />
          </Pressable>
        ) : null}
        <Text numberOfLines={1} style={[styles.title, detail && styles.detailTitle]}>{title}</Text>
        {!hideSettings ? (
          <Pressable accessibilityLabel="Settings" accessibilityRole="button" hitSlop={10} onPress={() => router.push('/(owner)/settings')} style={styles.iconButton}>
            <Settings color={colors.terracotta} size={22} strokeWidth={2.5} />
          </Pressable>
        ) : detail ? <View style={styles.iconButton} /> : null}
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={[styles.content, detail && styles.detailContent, contentContainerStyle]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { alignSelf: 'center', backgroundColor: colors.cream, flex: 1, maxWidth: 430, width: '100%' },
  header: { alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 69, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  iconButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  title: { color: colors.terracotta, flex: 1, fontFamily: fonts.extraBold, fontSize: 21, lineHeight: 28 },
  detailTitle: { color: colors.terracotta, fontSize: 21, textAlign: 'left' },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxl },
  detailContent: { paddingBottom: spacing.xxxl },
});
