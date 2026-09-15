import { HankenGrotesk_400Regular } from '@expo-google-fonts/hanken-grotesk/400Regular';
import { HankenGrotesk_500Medium } from '@expo-google-fonts/hanken-grotesk/500Medium';
import { HankenGrotesk_600SemiBold } from '@expo-google-fonts/hanken-grotesk/600SemiBold';
import { HankenGrotesk_700Bold } from '@expo-google-fonts/hanken-grotesk/700Bold';
import { HankenGrotesk_800ExtraBold } from '@expo-google-fonts/hanken-grotesk/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AuthProvider } from '@/state/auth';
import { colors } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({ HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold, HankenGrotesk_700Bold, HankenGrotesk_800ExtraBold });

  useEffect(() => { if (loaded || error) void SplashScreen.hideAsync(); }, [error, loaded]);
  if (!loaded && !error) return null;

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.cream }, headerShown: false }} />
    </AuthProvider>
  );
}
