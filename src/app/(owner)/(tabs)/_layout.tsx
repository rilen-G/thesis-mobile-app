import { Tabs } from 'expo-router';
import { Grid3X3, History, Megaphone, ReceiptText, UsersRound, Utensils } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';

import { colors, fonts } from '@/theme/tokens';
import { useOperations } from '@/state/operations';

const icons = { dashboard: Grid3X3, orders: ReceiptText, customers: UsersRound, menu: Utensils, promos: Megaphone, activity: History };

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { data } = useOperations();
  const staff = data?.role === 'staff';
  return (
    <Tabs screenOptions={({ route }) => {
      const Icon = icons[route.name as keyof typeof icons] ?? Grid3X3;
      return {
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarIcon: ({ color, focused }) => <View style={[styles.iconWell, focused && styles.activeIconWell]}><Icon color={color} size={19} strokeWidth={focused ? 2.7 : 2.2} /></View>,
        tabBarIconStyle: styles.iconSlot,
        tabBarItemStyle: { paddingTop: 0 },
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 10 },
        tabBarStyle: [styles.tabBar, { height: 84 + insets.bottom, paddingBottom: 12 + insets.bottom }],
      };
    }}>
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders' }} />
      <Tabs.Screen name="customers" options={{ title: 'Customers' }} />
      <Tabs.Screen name="menu" options={{ title: 'Menu' }} />
      <Tabs.Screen name="promos" options={{ title: 'Promos', href: staff ? null : undefined }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', href: staff ? null : undefined }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: { alignSelf: 'center', width: '100%', maxWidth: 430, backgroundColor: colors.card, borderTopColor: colors.line, paddingTop: 8 },
  iconSlot: { height: 40, width: 40 },
  iconWell: { alignItems: 'center', borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  activeIconWell: { backgroundColor: colors.amber },
});
