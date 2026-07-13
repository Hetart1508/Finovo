import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme/tokens';

const toneColors = { positive: colors.success, negative: colors.danger, primary: colors.primary, neutral: colors.text };

export function MetricCard({ label, value, tone }: { label: string; value: string; tone: keyof typeof toneColors }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.value, { color: toneColors[tone] }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '47.5%', minHeight: 112, justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.surface, padding: spacing.md },
  label: { ...typography.caption, color: colors.muted, textTransform: 'uppercase' },
  value: { ...typography.title },
});
