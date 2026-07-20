import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import sanariLogo from '@/assets/sanari-logo.png';

interface MobileHeaderProps {
  onSettingsClick: () => void;
  onSignOut?: () => void;
  headerActions?: React.ReactNode;
  notificationBell?: React.ReactNode;
}

export function MobileHeader({ onSettingsClick, headerActions, notificationBell }: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-12 items-center justify-between px-4">
        <img src={sanariLogo} alt="Sanari AI" className="h-7 w-auto" />
        <div className="flex items-center gap-1">
          {notificationBell}
          {headerActions}
          <Button
            variant="ghost"
            size="icon"
            onClick={onSettingsClick}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
