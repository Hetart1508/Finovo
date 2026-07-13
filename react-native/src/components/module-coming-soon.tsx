import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '@/theme/tokens';

export function ModuleComingSoon({ icon, phase, title, description }: { icon: ComponentProps<typeof Ionicons>['name']; phase: string; title: string; description: string }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <View style={styles.icon}><Ionicons name={icon} size={34} color={colors.primary} /></View>
        <Text style={styles.phase}>{phase}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.background },
  card: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.surface },
  icon: { width: 70, height: 70, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, marginBottom: spacing.sm },
  phase: { ...typography.caption, color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { ...typography.title, color: colors.text, textAlign: 'center' },
  description: { ...typography.body, color: colors.muted, textAlign: 'center' },
});
