import { useLocalSearchParams } from 'expo-router';

import { ModuleComingSoon } from '@/components/module-coming-soon';

const moduleDetails: Record<string, { title: string; phase: string; description: string }> = {
  'statement-import': { title: 'Statement Import', phase: 'Phase 4', description: 'Native document selection, password support, review and approval.' },
  calendar: { title: 'Calendar', phase: 'Phase 3', description: 'Monthly spending visualization and threshold alerts.' },
  recurring: { title: 'Recurring', phase: 'Phase 5', description: 'Subscriptions, EMIs and upcoming payment planning.' },
  investments: { title: 'Investments', phase: 'Phase 5', description: 'Portfolio tracking, SIP calculations and projections.' },
  'wealth-advisor': { title: 'Wealth Advisor', phase: 'Phase 6', description: 'Portfolio-aware AI chat and saved sessions.' },
  profile: { title: 'Profile', phase: 'Phase 2', description: 'Profile, family wallets, report preferences and account controls.' },
};

export default function ModuleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const details = moduleDetails[slug] ?? { title: 'Finovo', phase: 'Planned', description: 'This module is on the mobile roadmap.' };
  return <ModuleComingSoon icon="construct-outline" {...details} />;
}
