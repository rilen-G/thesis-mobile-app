import { Tabs } from 'expo-router';
import { Grid3X3, History, Megaphone, ReceiptText, UsersRound, Utensils } from 'lucide-react-native';

import { colors, fonts } from '@/theme/tokens';

const icons = { dashboard: Grid3X3, orders: ReceiptText, customers: UsersRound, menu: Utensils, promos: Megaphone, activity: History };

export default function TabsLayout() {
  return (
    <Tabs screenOptions={({ route }) => {
      const Icon = icons[route.name as keyof typeof icons] ?? Grid3X3;
      return {
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarIcon: ({ color, focused }) => <Icon color={color} fill={focused ? colors.amber : 'transparent'} size={20} strokeWidth={focused ? 2.7 : 2.2} />,
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 10 },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line, height: 76, paddingBottom: 8, paddingTop: 7 },
      };
    }}>
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders' }} />
      <Tabs.Screen name="customers" options={{ title: 'Customers' }} />
      <Tabs.Screen name="menu" options={{ title: 'Menu' }} />
      <Tabs.Screen name="promos" options={{ title: 'Promos' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
    </Tabs>
  );
}
