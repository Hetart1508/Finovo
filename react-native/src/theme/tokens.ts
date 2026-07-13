import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  primary: '#4F9CF9',
  primaryPressed: '#3F8BE5',
  primarySoft: '#EEF6FF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#1F2937',
  muted: '#6B7280',
  border: '#E5E7EB',
  success: '#16865C',
  successSoft: '#EAF8F1',
  danger: '#D94A4A',
  dangerSoft: '#FFF1F1',
  warning: '#B7791F',
} as const;

export const spacing = {
  xxs: 4,
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '800' } satisfies TextStyle,
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800' } satisfies TextStyle,
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' } satisfies TextStyle,
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' } satisfies TextStyle,
  label: { fontSize: 14, lineHeight: 20, fontWeight: '700' } satisfies TextStyle,
  caption: { fontSize: 12, lineHeight: 17, fontWeight: '500' } satisfies TextStyle,
} as const;

export const shadows = {
  card: {
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  } satisfies ViewStyle,
};
