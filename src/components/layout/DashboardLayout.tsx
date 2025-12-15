import { ReactNode, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Settings, Heart } from 'lucide-react';
import { SettingsDialog } from './SettingsDialog';

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
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-teal-600 bg-clip-text text-transparent">
              AiDx
            </span>
            {title && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="font-medium text-sm text-foreground/80">{title}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:block text-right">
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

      {/* Main Content */}
      <main className="container py-6 pb-24 max-w-lg mx-auto md:max-w-4xl">
        {children}
      </main>

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}