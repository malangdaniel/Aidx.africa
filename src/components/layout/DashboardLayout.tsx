import { ReactNode, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { User, LucideIcon } from 'lucide-react';
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
    <div className="min-h-screen bg-background bg-ambient-mesh flex flex-col text-foreground font-sans">
      {/* Mobile Header */}
      <div className="md:hidden">
        <MobileHeader
          onSettingsClick={() => setShowSettings(true)}
          headerActions={headerActions}
          notificationBell={<NotificationBell />}
        />
      </div>

      {/* Desktop Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 shadow-2xs hidden md:block">
        <div className="container flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <img src={sanariLogo} alt="Sanari AI — AI healthcare and telemedicine" className="h-8 w-auto object-contain transition-transform hover:scale-105" width={160} height={32} />
            </div>
            {title && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground/40 font-light">|</span>
                <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">{title}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {headerActions}
            <NotificationBell />
            
            <div className="h-5 w-px bg-border/60 mx-1" />

            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-3 p-1.5 pl-3 rounded-full border border-border/60 bg-card/60 hover:bg-muted/70 hover:border-primary/30 transition-all duration-200 group text-left"
            >
              <div className="text-right leading-tight hidden sm:block">
                <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{getDisplayName()}</p>
                <p className="text-[10px] font-medium text-muted-foreground capitalize">{profile?.role}</p>
              </div>
              <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-xs border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                {profile?.first_name ? profile.first_name[0].toUpperCase() : <User className="w-4 h-4" />}
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-background" />
              </div>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 container max-w-screen-2xl p-0">
        {/* Desktop Sidebar */}
        {tabs && onTabChange && (
          <aside className="hidden md:flex flex-col w-64 border-r border-border/50 bg-card/40 backdrop-blur-md h-[calc(100vh-4rem)] sticky top-16">
            <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto scrollbar-custom">
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-bold px-3 pt-2 pb-1">Navigation</p>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={cn(
                      "group relative flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 transition-transform group-hover:scale-110", isActive ? "text-primary-foreground" : "text-primary/80")} />
                    <span>{tab.label}</span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-border/50 space-y-1 bg-muted/20">
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-bold px-3 mb-1.5">Account</p>
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all duration-200"
              >
                <User className="w-4 h-4 text-primary/80" />
                Profile Settings
              </button>
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className={cn(
          "flex-1 px-4 py-5 pb-24 md:py-8 md:pb-8 max-w-full overflow-hidden",
          tabs ? "md:px-8" : "md:px-6"
        )}>
          {children}
        </main>
      </div>

      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}
