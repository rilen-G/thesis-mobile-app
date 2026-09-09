import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  cream: '#FCF9F2', surface: '#FFF8F6', card: '#FFFFFF', ink: '#241917', muted: '#57423E',
  subtleText: '#6D5751', line: '#E5E0D5', terracotta: '#8E2D1B', terracottaDark: '#6E1606',
  terracottaLight: '#B54632', terracottaSoft: '#FFDAD3', amber: '#FFB800', amberDark: '#7C5800',
  amberSoft: '#FFF4D1', ready: '#2D6A4F', readySoft: '#E6F3F1', preparing: '#D97706',
  tertiary: '#005575', tertiarySoft: '#E7F3F8', neutralSoft: '#F1E7DF', menuSoft: '#FCF7EF',
  messenger: '#1686F3', dangerSoft: '#FFF1ED', shadow: 'rgba(36,25,23,0.07)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;
export const radii = { sm: 6, md: 8, lg: 12, xl: 18, pill: 999 } as const;

export const fonts = {
  regular: 'HankenGrotesk_400Regular', medium: 'HankenGrotesk_500Medium',
  semiBold: 'HankenGrotesk_600SemiBold', bold: 'HankenGrotesk_700Bold', extraBold: 'HankenGrotesk_800ExtraBold',
} as const;

export const textStyles = {
  display: { fontFamily: fonts.extraBold, fontSize: 26, lineHeight: 36, color: colors.ink } satisfies TextStyle,
  headline: { fontFamily: fonts.extraBold, fontSize: 21, lineHeight: 28, color: colors.ink } satisfies TextStyle,
  title: { fontFamily: fonts.extraBold, fontSize: 18, lineHeight: 24, color: colors.ink } satisfies TextStyle,
  body: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.muted } satisfies TextStyle,
  label: { fontFamily: fonts.extraBold, fontSize: 12, lineHeight: 16, color: colors.ink } satisfies TextStyle,
  tiny: { fontFamily: fonts.semiBold, fontSize: 11, lineHeight: 15, color: colors.muted } satisfies TextStyle,
} as const;

export const cardShadow: ViewStyle = {
  boxShadow: `0 4px 14px ${colors.shadow}`,
};
