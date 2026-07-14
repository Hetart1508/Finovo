import { RiCheckLine, RiPaletteLine, RiRestartLine } from 'react-icons/ri';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent } from '@/src/components/ui/card';
import { DEFAULT_PERSONALIZATION_THEME_ID } from '@/src/features/personalization/personalization.constants';
import { usePersonalization } from '@/src/features/personalization/PersonalizationProvider';
import type { PersonalizationThemeId } from '@/src/features/personalization/personalization.types';
import { cn } from '@/lib/utils';

export default function Personalization() {
  const { themeId, themes, setThemeId } = usePersonalization();

  const handleThemeSelect = (nextThemeId: PersonalizationThemeId) => {
    setThemeId(nextThemeId);
  };

  return (
    <div className="space-y-6 kt-enter">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-primary">Personalization</p>
          <h1 className="mt-2 text-2xl font-black leading-tight text-foreground sm:text-3xl">Choose your workspace theme</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Pick a color system for the app chrome, controls, charts, and common financial states.
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full gap-2 md:w-auto"
          onClick={() => handleThemeSelect(DEFAULT_PERSONALIZATION_THEME_ID)}
        >
          <RiRestartLine aria-hidden="true" />
          Reset theme
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {themes.map((themeOption) => {
          const isSelected = themeOption.id === themeId;
          return (
            <button
              key={themeOption.id}
              type="button"
              className={cn(
                'group rounded-lg text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
                isSelected ? 'ring-2 ring-ring' : 'ring-1 ring-border hover:ring-ring/50'
              )}
              onClick={() => handleThemeSelect(themeOption.id)}
              aria-pressed={isSelected}
            >
              <Card className="h-full rounded-lg border-0 shadow-none">
                <CardContent className="flex h-full flex-col gap-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-foreground">{themeOption.name}</p>
                      <p className="mt-1 text-sm leading-5 text-muted-foreground">{themeOption.description}</p>
                    </div>
                    <span
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground'
                      )}
                    >
                      {isSelected ? <RiCheckLine aria-hidden="true" /> : <RiPaletteLine aria-hidden="true" />}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {themeOption.swatches.map((swatch) => (
                      <span
                        key={swatch}
                        className="h-12 rounded-lg border border-border"
                        style={{ backgroundColor: swatch }}
                        aria-hidden="true"
                      />
                    ))}
                  </div>

                  <div className="mt-auto rounded-lg border border-border bg-background p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="h-2 w-20 rounded-full" style={{ backgroundColor: themeOption.variables['--primary'] }} />
                      <span className="h-2 w-12 rounded-full" style={{ backgroundColor: themeOption.variables['--border'] }} />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="h-8 rounded-md" style={{ backgroundColor: themeOption.variables['--color-success-soft'] }} />
                      <span className="h-8 rounded-md" style={{ backgroundColor: themeOption.variables['--color-warning-soft'] }} />
                      <span className="h-8 rounded-md" style={{ backgroundColor: themeOption.variables['--color-expense-soft'] }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}
