import { Button } from '@/components/ui/button';
import { User } from 'lucide-react';
import sanariLogo from '@/assets/sanari-logo.png';

interface MobileHeaderProps {
  onSettingsClick: () => void;
  onSignOut?: () => void;
  headerActions?: React.ReactNode;
  notificationBell?: React.ReactNode;
}

export function MobileHeader({ onSettingsClick, headerActions, notificationBell }: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 shadow-2xs">
      <div className="flex h-14 items-center justify-between px-4">
        <img src={sanariLogo} alt="Sanari AI" className="h-7 w-auto object-contain" />
        <div className="flex items-center gap-1.5">
          {notificationBell}
          {headerActions}
          <Button
            variant="ghost"
            size="icon"
            onClick={onSettingsClick}
            className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/70"
          >
            <User className="w-4 h-4 text-primary" />
          </Button>
        </div>
      </div>
    </header>
  );
}
