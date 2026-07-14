import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { storageKeys } from '@/src/lib/storageKeys';
import {
  DEFAULT_PERSONALIZATION_THEME_ID,
  personalizationThemeMap,
  personalizationThemes,
} from './personalization.constants';
import type { PersonalizationTheme, PersonalizationThemeId } from './personalization.types';

interface PersonalizationContextValue {
  theme: PersonalizationTheme;
  themeId: PersonalizationThemeId;
  themes: PersonalizationTheme[];
  setThemeId: (themeId: PersonalizationThemeId) => void;
}

const PersonalizationContext = createContext<PersonalizationContextValue | undefined>(undefined);

const getInitialThemeId = (): PersonalizationThemeId => {
  if (typeof window === 'undefined') return DEFAULT_PERSONALIZATION_THEME_ID;
  const savedThemeId = localStorage.getItem(storageKeys.personalizationTheme) as PersonalizationThemeId | null;
  return savedThemeId && personalizationThemeMap.has(savedThemeId)
    ? savedThemeId
    : DEFAULT_PERSONALIZATION_THEME_ID;
};

export function PersonalizationProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<PersonalizationThemeId>(getInitialThemeId);
  const theme = personalizationThemeMap.get(themeId) ?? personalizationThemeMap.get(DEFAULT_PERSONALIZATION_THEME_ID)!;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.personalizationTheme = theme.id;
    Object.entries(theme.variables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
    localStorage.setItem(storageKeys.personalizationTheme, theme.id);
  }, [theme]);

  const value = useMemo<PersonalizationContextValue>(() => ({
    theme,
    themeId,
    themes: personalizationThemes,
    setThemeId: setThemeIdState,
  }), [theme, themeId]);

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
