import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { storageKeys } from '@/src/lib/storageKeys';
import {
  chartPaletteVariables,
  DEFAULT_PERSONALIZATION_THEME_ID,
  DEFAULT_PERSONALIZATION_PREFERENCES,
  personalizationThemeMap,
  personalizationThemes,
} from './personalization.constants';
import type {
  PersonalizationPreferences,
  PersonalizationTheme,
  PersonalizationThemeId,
  ThemeVariables,
} from './personalization.types';

interface PersonalizationContextValue {
  theme: PersonalizationTheme;
  themeId: PersonalizationThemeId;
  themes: PersonalizationTheme[];
  setThemeId: (themeId: PersonalizationThemeId) => void;
  preferences: PersonalizationPreferences;
  updatePreferences: (preferences: Partial<PersonalizationPreferences>) => void;
  resetPersonalization: () => void;
}

const PersonalizationContext = createContext<PersonalizationContextValue | undefined>(undefined);

const getInitialThemeId = (): PersonalizationThemeId => {
  if (typeof window === 'undefined') return DEFAULT_PERSONALIZATION_THEME_ID;
  const savedThemeId = localStorage.getItem(storageKeys.personalizationTheme) as PersonalizationThemeId | null;
  return savedThemeId && personalizationThemeMap.has(savedThemeId)
    ? savedThemeId
    : DEFAULT_PERSONALIZATION_THEME_ID;
};

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

const getInitialPreferences = (): PersonalizationPreferences => {
  if (typeof window === 'undefined') return DEFAULT_PERSONALIZATION_PREFERENCES;

  try {
    const savedPreferences = localStorage.getItem(storageKeys.personalizationPreferences);
    if (!savedPreferences) return DEFAULT_PERSONALIZATION_PREFERENCES;
    const parsed = JSON.parse(savedPreferences) as Partial<PersonalizationPreferences>;

    return {
      appearanceMode: parsed.appearanceMode === 'dark' ? 'dark' : DEFAULT_PERSONALIZATION_PREFERENCES.appearanceMode,
      density: parsed.density === 'compact' || parsed.density === 'spacious' ? parsed.density : DEFAULT_PERSONALIZATION_PREFERENCES.density,
      radius: parsed.radius === 'sharp' || parsed.radius === 'soft' ? parsed.radius : DEFAULT_PERSONALIZATION_PREFERENCES.radius,
      sidebarStyle: parsed.sidebarStyle === 'tinted' || parsed.sidebarStyle === 'dark' ? parsed.sidebarStyle : DEFAULT_PERSONALIZATION_PREFERENCES.sidebarStyle,
      chartPalette: parsed.chartPalette === 'vibrant' || parsed.chartPalette === 'accessible' || parsed.chartPalette === 'muted' ? parsed.chartPalette : DEFAULT_PERSONALIZATION_PREFERENCES.chartPalette,
      highContrast: isBoolean(parsed.highContrast) ? parsed.highContrast : DEFAULT_PERSONALIZATION_PREFERENCES.highContrast,
      largeText: isBoolean(parsed.largeText) ? parsed.largeText : DEFAULT_PERSONALIZATION_PREFERENCES.largeText,
      reducedMotion: isBoolean(parsed.reducedMotion) ? parsed.reducedMotion : DEFAULT_PERSONALIZATION_PREFERENCES.reducedMotion,
    };
  } catch {
    return DEFAULT_PERSONALIZATION_PREFERENCES;
  }
};

const darkModeOverrides = (variables: ThemeVariables): Partial<ThemeVariables> => ({
  '--background': '#0F172A',
  '--foreground': '#E5E7EB',
  '--card': '#111827',
  '--card-foreground': '#F8FAFC',
  '--popover': '#111827',
  '--popover-foreground': '#F8FAFC',
  '--secondary': 'color-mix(in oklab, var(--primary) 20%, #111827)',
  '--secondary-foreground': '#F8FAFC',
  '--muted': '#1F2937',
  '--muted-foreground': '#CBD5E1',
  '--accent': 'color-mix(in oklab, var(--primary) 22%, #111827)',
  '--accent-foreground': '#F8FAFC',
  '--border': '#334155',
  '--input': '#334155',
  '--sidebar': '#0B1220',
  '--sidebar-foreground': '#E5E7EB',
  '--sidebar-accent': 'color-mix(in oklab, var(--primary) 18%, #0B1220)',
  '--sidebar-accent-foreground': '#F8FAFC',
  '--sidebar-border': '#1E293B',
  '--color-primary-soft': 'color-mix(in oklab, var(--primary) 20%, #111827)',
  '--color-success-soft': 'color-mix(in oklab, var(--color-success) 18%, #111827)',
  '--color-expense-soft': 'color-mix(in oklab, var(--color-expense) 18%, #111827)',
  '--color-warning-soft': 'color-mix(in oklab, var(--color-warning) 20%, #111827)',
  '--kt-app-bg': '#0F172A',
  '--kt-app-surface': 'color-mix(in oklab, #111827 92%, transparent)',
  '--kt-app-border': 'color-mix(in oklab, #334155 80%, transparent)',
  '--kt-app-shadow': '0 18px 55px rgba(0, 0, 0, 0.28)',
  '--chart-1': variables['--chart-1'],
  '--chart-2': variables['--chart-2'],
  '--chart-3': variables['--chart-3'],
  '--chart-4': variables['--chart-4'],
  '--chart-5': variables['--chart-5'],
});

const getAppliedVariables = (
  theme: PersonalizationTheme,
  preferences: PersonalizationPreferences
): ThemeVariables => {
  const variables = {
    ...theme.variables,
    ...(preferences.appearanceMode === 'dark' ? darkModeOverrides(theme.variables) : {}),
    ...(preferences.chartPalette === 'theme' ? {} : chartPaletteVariables[preferences.chartPalette]),
  };

  if (preferences.highContrast) {
    variables['--border'] = preferences.appearanceMode === 'dark' ? '#64748B' : '#CBD5E1';
    variables['--muted-foreground'] = preferences.appearanceMode === 'dark' ? '#F1F5F9' : '#334155';
    variables['--input'] = variables['--border'];
  }

  return variables;
};

export function PersonalizationProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<PersonalizationThemeId>(getInitialThemeId);
  const [preferences, setPreferences] = useState<PersonalizationPreferences>(getInitialPreferences);
  const theme = personalizationThemeMap.get(themeId) ?? personalizationThemeMap.get(DEFAULT_PERSONALIZATION_THEME_ID)!;

  useEffect(() => {
    const root = document.documentElement;
    const appliedVariables = getAppliedVariables(theme, preferences);

    root.dataset.personalizationTheme = theme.id;
    root.dataset.appearanceMode = preferences.appearanceMode;
    root.dataset.density = preferences.density;
    root.dataset.radius = preferences.radius;
    root.dataset.sidebarStyle = preferences.sidebarStyle;
    root.dataset.chartPalette = preferences.chartPalette;
    root.dataset.highContrast = String(preferences.highContrast);
    root.dataset.largeText = String(preferences.largeText);
    root.dataset.reducedMotion = String(preferences.reducedMotion);

    Object.entries(appliedVariables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    root.style.setProperty('--radius', preferences.radius === 'sharp' ? '0.35rem' : preferences.radius === 'soft' ? '0.85rem' : '0.55rem');
    root.style.setProperty('--app-control-height', preferences.density === 'compact' ? '2.25rem' : preferences.density === 'spacious' ? '2.75rem' : '2.5rem');
    root.style.setProperty('--app-card-padding', preferences.density === 'compact' ? '0.75rem' : preferences.density === 'spacious' ? '1.25rem' : '1rem');
    root.style.setProperty('--app-motion-duration', preferences.reducedMotion ? '1ms' : '180ms');

    localStorage.setItem(storageKeys.personalizationTheme, theme.id);
    localStorage.setItem(storageKeys.personalizationPreferences, JSON.stringify(preferences));
  }, [theme, preferences]);

  const updatePreferences = (nextPreferences: Partial<PersonalizationPreferences>) => {
    setPreferences((currentPreferences) => ({ ...currentPreferences, ...nextPreferences }));
  };

  const resetPersonalization = () => {
    setThemeIdState(DEFAULT_PERSONALIZATION_THEME_ID);
    setPreferences(DEFAULT_PERSONALIZATION_PREFERENCES);
  };

  const value = useMemo<PersonalizationContextValue>(() => ({
    theme,
    themeId,
    themes: personalizationThemes,
    setThemeId: setThemeIdState,
    preferences,
    updatePreferences,
    resetPersonalization,
  }), [theme, themeId, preferences]);

  return (
    <PersonalizationContext.Provider value={value}>
      {children}
    </PersonalizationContext.Provider>
  );
}

export const usePersonalization = () => {
  const context = useContext(PersonalizationContext);
  if (!context) {
    throw new Error('usePersonalization must be used within PersonalizationProvider');
  }
  return context;
};
