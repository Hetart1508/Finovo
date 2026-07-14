import {
  RiBarChartBoxLine,
  RiCheckLine,
  RiContrast2Line,
  RiLayoutLeftLine,
  RiPaletteLine,
  RiRestartLine,
} from 'react-icons/ri';
import type { ReactNode } from 'react';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent } from '@/src/components/ui/card';
import {
  appearanceModeOptions,
  chartPaletteOptions,
  densityOptions,
  radiusOptions,
  sidebarStyleOptions,
} from '@/src/features/personalization/personalization.constants';
import { usePersonalization } from '@/src/features/personalization/PersonalizationProvider';
import type {
  PersonalizationOption,
  PersonalizationThemeId,
} from '@/src/features/personalization/personalization.types';
import { cn } from '@/lib/utils';

export default function Personalization() {
  const {
    themeId,
    themes,
    setThemeId,
    preferences,
    updatePreferences,
    resetPersonalization,
  } = usePersonalization();

  const handleThemeSelect = (nextThemeId: PersonalizationThemeId) => {
    setThemeId(nextThemeId);
  };

  return (
    <div className="space-y-6 kt-enter">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-primary">Personalization</p>
          <h1 className="mt-2 text-2xl font-black leading-tight text-foreground sm:text-3xl">Tune your workspace</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Adjust the app's visual system without changing the way your finance workflows behave.
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full gap-2 md:w-auto"
          onClick={resetPersonalization}
        >
          <RiRestartLine aria-hidden="true" />
          Reset all
        </Button>
      </div>

      <div className="space-y-4">
          <SectionCard
            icon={<RiPaletteLine />}
            title="Color Theme"
            description="Themes control brand accents, soft states, charts, controls, and common finance status colors."
          >
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
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
                    <div className="h-full rounded-lg bg-card p-3 text-card-foreground">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{themeOption.name}</p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{themeOption.description}</p>
                        </div>
                        <span
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
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
                            className="h-9 rounded-md border border-border"
                            style={{ backgroundColor: swatch }}
                            aria-hidden="true"
                          />
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            icon={<RiLayoutLeftLine />}
            title="Layout System"
            description="Density, radius, and navigation treatment help reduce inconsistencies across dashboards, tables, and forms."
          >
            <div className="grid gap-4 xl:grid-cols-3">
              <SegmentGroup
                label="Density"
                value={preferences.density}
                options={densityOptions}
                onChange={(density) => updatePreferences({ density })}
              />
              <SegmentGroup
                label="Corner Radius"
                value={preferences.radius}
                options={radiusOptions}
                onChange={(radius) => updatePreferences({ radius })}
              />
              <SegmentGroup
                label="Sidebar"
                value={preferences.sidebarStyle}
                options={sidebarStyleOptions}
                onChange={(sidebarStyle) => updatePreferences({ sidebarStyle })}
              />
            </div>
          </SectionCard>

          <SectionCard
            icon={<RiBarChartBoxLine />}
            title="Charts"
            description="Choose whether analysis colors follow the theme or use a dedicated reporting palette."
          >
            <SegmentGroup
              label="Chart Palette"
              value={preferences.chartPalette}
              options={chartPaletteOptions}
              onChange={(chartPalette) => updatePreferences({ chartPalette })}
              columns="md:grid-cols-2 2xl:grid-cols-4"
            />
          </SectionCard>

          <SectionCard
            icon={<RiContrast2Line />}
            title="Accessibility"
            description="Improve readability and motion comfort while keeping the same app functionality."
          >
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
              <SegmentGroup
                label="Mode"
                value={preferences.appearanceMode}
                options={appearanceModeOptions}
                onChange={(appearanceMode) => updatePreferences({ appearanceMode })}
              />
              <ToggleOption
                label="High Contrast"
                description="Stronger text and control borders."
                checked={preferences.highContrast}
                onChange={(highContrast) => updatePreferences({ highContrast })}
              />
              <ToggleOption
                label="Larger Text"
                description="Slightly larger UI text across the app."
                checked={preferences.largeText}
                onChange={(largeText) => updatePreferences({ largeText })}
              />
              <ToggleOption
                label="Reduced Motion"
                description="Keeps transitions minimal for comfort."
                checked={preferences.reducedMotion}
                onChange={(reducedMotion) => updatePreferences({ reducedMotion })}
              />
            </div>
          </SectionCard>
      </div>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-lg">
      <CardContent className="p-4">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground">{title}</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function SegmentGroup<TValue extends string>({
  label,
  value,
  options,
  onChange,
  columns = 'grid-cols-1',
}: {
  label: string;
  value: TValue;
  options: PersonalizationOption<TValue>[];
  onChange: (value: TValue) => void;
  columns?: string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <div className={cn('grid gap-2', columns)}>
        {options.map((option) => {
          const isSelected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              className={cn(
                'min-w-0 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isSelected
                  ? 'border-primary bg-secondary text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
              )}
              onClick={() => onChange(option.id)}
              aria-pressed={isSelected}
            >
              <span className="flex min-w-0 items-center justify-between gap-2">
                <span className="min-w-0 text-sm font-bold">{option.label}</span>
                {isSelected ? <RiCheckLine className="text-primary" aria-hidden="true" /> : null}
              </span>
              <span className="mt-1 block text-xs leading-5">{option.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToggleOption({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex min-h-[5.75rem] min-w-0 items-start justify-between gap-3 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        checked
          ? 'border-primary bg-secondary text-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
      )}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold">{label}</span>
        <span className="mt-1 block text-xs leading-5">{description}</span>
      </span>
      <span
        className={cn(
          'mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full border p-0.5 transition',
          checked ? 'justify-end border-primary bg-primary' : 'justify-start border-border bg-muted'
        )}
        aria-hidden="true"
      >
        <span className="h-4 w-4 rounded-full bg-card shadow-sm" />
      </span>
    </button>
  );
}
