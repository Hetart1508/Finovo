import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

import { FullScreenLoader } from '@/components/ui/full-screen-loader';
import { useAuth } from '@/features/auth/auth-provider';
import { colors } from '@/theme/tokens';

const iconByRoute = {
  index: ['grid-outline', 'grid'],
  transactions: ['receipt-outline', 'receipt'],
  upload: ['scan-outline', 'scan'],
  insights: ['sparkles-outline', 'sparkles'],
  more: ['menu-outline', 'menu'],
} as const;

export default function AppTabsLayout() {
  const { status } = useAuth();
  if (status === 'loading') return <FullScreenLoader label="Loading workspace..." />;
  if (status !== 'authenticated') return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.surface },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIcon: ({ color, focused, size }) => {
          const icons = iconByRoute[route.name as keyof typeof iconByRoute];
          return <Ionicons name={icons?.[focused ? 1 : 0] ?? 'ellipse-outline'} color={color} size={size} />;
        },
      })}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transactions' }} />
      <Tabs.Screen name="upload" options={{ title: 'Upload' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
