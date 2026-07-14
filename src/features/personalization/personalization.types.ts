export type PersonalizationThemeId =
  | 'finovo'
  | 'emerald'
  | 'sunrise'
  | 'rose'
  | 'indigo'
  | 'aqua'
  | 'graphite'
  | 'orchid'
  | 'copper'
  | 'mono';

export type AppearanceMode = 'light' | 'dark';
export type DensityMode = 'comfortable' | 'compact' | 'spacious';
export type RadiusMode = 'sharp' | 'balanced' | 'soft';
export type SidebarStyle = 'light' | 'tinted' | 'dark';
export type ChartPaletteId = 'theme' | 'vibrant' | 'accessible' | 'muted';

export type ThemeVariableName =
  | '--background'
  | '--foreground'
  | '--card'
  | '--card-foreground'
  | '--popover'
  | '--popover-foreground'
  | '--primary'
  | '--primary-foreground'
  | '--secondary'
  | '--secondary-foreground'
  | '--muted'
  | '--muted-foreground'
  | '--accent'
  | '--accent-foreground'
  | '--destructive'
  | '--border'
  | '--input'
  | '--ring'
  | '--chart-1'
  | '--chart-2'
  | '--chart-3'
  | '--chart-4'
  | '--chart-5'
  | '--sidebar'
  | '--sidebar-foreground'
  | '--sidebar-primary'
  | '--sidebar-primary-foreground'
  | '--sidebar-accent'
  | '--sidebar-accent-foreground'
  | '--sidebar-border'
  | '--sidebar-ring'
  | '--color-primary-soft'
  | '--color-success'
  | '--color-success-soft'
  | '--color-expense'
  | '--color-expense-soft'
  | '--color-warning'
  | '--color-warning-soft'
  | '--kt-app-bg'
  | '--kt-app-surface'
  | '--kt-app-border'
  | '--kt-app-shadow';

export type ThemeVariables = Record<ThemeVariableName, string>;

export interface PersonalizationTheme {
  id: PersonalizationThemeId;
  name: string;
  description: string;
  swatches: string[];
  variables: ThemeVariables;
}

export interface PersonalizationPreferences {
  appearanceMode: AppearanceMode;
  density: DensityMode;
  radius: RadiusMode;
  sidebarStyle: SidebarStyle;
  chartPalette: ChartPaletteId;
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
}

export interface PersonalizationOption<TValue extends string> {
  id: TValue;
  label: string;
  description: string;
}
