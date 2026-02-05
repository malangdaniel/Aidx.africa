import { ReactNode, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { SettingsDialog } from './SettingsDialog';
import { MobileHeader } from './MobileHeader';
import aidxLogo from '@/assets/aidx-logo.png';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const { profile } = useAuth();
  const [showSettings, setShowSettings] = useState(false);

  const getDisplayName = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    return `${profile?.role?.charAt(0).toUpperCase()}${profile?.role?.slice(1)} User`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Mobile Header */}
      <div className="md:hidden">
        <MobileHeader onSettingsClick={() => setShowSettings(true)} />
      </div>

      {/* Desktop Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 hidden md:block">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={aidxLogo} alt="AiDx Logo" className="h-8 w-auto" />
            {title && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="font-medium text-sm text-foreground/80">{title}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium leading-none">{getDisplayName()}</p>
              <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(true)}
              title="Settings"
              className="text-muted-foreground hover:text-foreground"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content - mobile-first padding */}
      <main className="px-4 py-4 pb-20 md:container md:py-6 md:pb-6">
        {children}
      </main>

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}
