import { Redirect } from 'expo-router';

import { FullScreenLoader } from '@/components/ui/full-screen-loader';
import { useAuth } from '@/features/auth/auth-provider';

export default function IndexScreen() {
  const { status } = useAuth();

  if (status === 'loading') return <FullScreenLoader label="Opening Finovo..." />;
  return <Redirect href={status === 'authenticated' ? '/(tabs)' : '/(auth)/sign-in'} />;
}
