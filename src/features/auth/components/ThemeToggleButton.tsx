import { Button } from '@/src/components/ui/button';
import { RiMoonLine, RiSunLine } from 'react-icons/ri';

type ThemeToggleButtonProps = {
  theme: string;
  onToggle: () => void;
};

export function ThemeToggleButton({ theme, onToggle }: ThemeToggleButtonProps) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <Button
      variant="outline"
      size="icon"
      className="fixed right-4 top-4 z-10 bg-white/90 shadow-sm backdrop-blur"
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      onClick={onToggle}
    >
      {theme === 'dark' ? <RiSunLine className="text-base" aria-hidden="true" /> : <RiMoonLine className="text-base" aria-hidden="true" />}
    </Button>
  );
}
