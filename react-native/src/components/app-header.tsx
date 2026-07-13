import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useWallet } from '@/features/wallets/wallet-provider';
import { colors, radii, spacing, typography } from '@/theme/tokens';

export function AppHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  const { wallets, selectedWalletId, selectWallet } = useWallet();
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.logo}><Text style={styles.logoText}>F</Text></View>
      </View>
      {wallets.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wallets}>
          {wallets.map((wallet) => {
            const selected = wallet.id === selectedWalletId;
            return (
              <Text
                accessibilityRole="button"
                key={wallet.id}
                onPress={() => selectWallet(wallet.id)}
                style={[styles.wallet, selected && styles.walletSelected]}>
                {wallet.type === 'personal' ? 'Personal wallet' : wallet.name}
              </Text>
            );
          })}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { ...typography.caption, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { ...typography.title, color: colors.text },
  logo: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  logoText: { ...typography.heading, color: colors.primary },
  wallets: { gap: spacing.sm },
  wallet: { ...typography.caption, color: colors.muted, borderWidth: 1, borderColor: colors.border, borderRadius: radii.pill, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: colors.surface, overflow: 'hidden' },
  walletSelected: { color: colors.primary, borderColor: colors.primary, backgroundColor: colors.primarySoft },
});
