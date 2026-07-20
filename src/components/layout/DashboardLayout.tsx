import { ReactNode, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Settings, LucideIcon } from 'lucide-react';
import { SettingsDialog } from './SettingsDialog';
import { MobileHeader } from './MobileHeader';
import { NotificationBell } from './NotificationBell';
import sanariLogo from '@/assets/sanari-logo.png';
import { cn } from '@/lib/utils';


export interface NavTab {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  tabs?: NavTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  headerActions?: React.ReactNode;
}

export default function DashboardLayout({
  children,
  title,
  tabs,
  activeTab,
  onTabChange,
  headerActions
}: DashboardLayoutProps) {
  const { profile } = useAuth();
  const [showSettings, setShowSettings] = useState(false);

  const getDisplayName = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    return `${profile?.role?.charAt(0).toUpperCase()}${profile?.role?.slice(1)} User`;
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex flex-col">
      {/* Mobile Header */}
      <div className="md:hidden">
        <MobileHeader
          onSettingsClick={() => setShowSettings(true)}
          headerActions={headerActions}
          notificationBell={<NotificationBell />}
        />
      </div>


      {/* Desktop Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 hidden md:block">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={sanariLogo} alt="Sanari AI" className="h-8 w-auto" />
            {title && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="font-medium text-sm text-foreground/80">{title}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            {headerActions}
            <NotificationBell />
            <div className="text-right">
              <p className="text-sm font-medium leading-none">{getDisplayName()}</p>
              <p className="text-xs text-muted-foreground capitalize">{profile?.role}</p>
            </div>

            <div className="flex items-center gap-2">
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
        </div>
      </header>

      <div className="flex flex-1 container max-w-screen-2xl p-0">
        {/* Desktop Sidebar */}
        {tabs && onTabChange && (
          <aside className="hidden md:flex flex-col w-64 border-r bg-background/50 h-[calc(100vh-3.5rem)] sticky top-14">
            <nav className="flex-1 p-4 space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className={cn("w-4 h-4", isActive ? "text-primary-foreground" : "text-primary")} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold px-3 mb-2">Account</p>
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Settings className="w-4 h-4 text-primary" />
                Settings
              </button>
            </div>

          </aside>
        )}

        {/* Main Content */}
        <main className={cn(
          "flex-1 px-4 py-4 pb-24 md:py-6 md:pb-6",
          tabs ? "md:px-8" : "md:px-4"
        )}>
          {children}
        </main>
      </div>

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}
