import Icon from '@/components/ui/Icon';
import { useSky } from '@/lib/sky';

// Day / night switch for the whole app (the editor's light/dark follows it).
export default function SkySwitch({ className }: { className?: string }) {
  const [sky, setSky] = useSky();

  return (
    <div className={`skyswitch glass${className ? ' ' + className : ''}`} role="group" aria-label="Theme">
      <button type="button" aria-pressed={sky === 'day'} aria-label="Switch to light theme" onClick={() => setSky('day')}>
        <Icon name="sun" />
      </button>
      <button type="button" aria-pressed={sky === 'night'} aria-label="Switch to dark theme" onClick={() => setSky('night')}>
        <Icon name="moon" />
      </button>
    </div>
  );
}
