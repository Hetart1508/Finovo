import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { useAuth } from '@/features/auth/auth-provider';
import { colors, radii, spacing, typography } from '@/theme/tokens';

const modules = [
  ['statement-import', 'document-text-outline', 'Statement Import'],
  ['calendar', 'calendar-outline', 'Calendar'],
  ['recurring', 'repeat-outline', 'Recurring'],
  ['investments', 'trending-up-outline', 'Investments'],
  ['wealth-advisor', 'chatbubbles-outline', 'Wealth Advisor'],
  ['profile', 'person-circle-outline', 'Profile'],
] as const;

export default function MoreScreen() {
  const { signOut } = useAuth();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppHeader eyebrow="All tools" title="More" />
      <View style={styles.card}>
        {modules.map(([slug, icon, label]) => (
          <Link key={slug} href={{ pathname: '/module/[slug]', params: { slug } }} asChild>
            <Pressable style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
              <View style={styles.icon}><Ionicons name={icon} size={20} color={colors.primary} /></View>
              <Text style={styles.label}>{label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          </Link>
        ))}
      </View>
      <Pressable onPress={signOut} style={styles.logout}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.surface, overflow: 'hidden' },
  item: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pressed: { backgroundColor: colors.primarySoft },
  icon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.label, flex: 1, color: colors.text },
  logout: { minHeight: 50, borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.dangerSoft },
  logoutText: { ...typography.label, color: colors.danger },
});
