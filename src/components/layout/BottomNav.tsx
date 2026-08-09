import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TabItem {
    id: string;
    label: string;
    icon: LucideIcon;
}

interface BottomNavProps {
    tabs: TabItem[];
    activeTab: string;
    onTabChange: (id: string) => void;
}

export default function BottomNav({ tabs, activeTab, onTabChange }: BottomNavProps) {
    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden safe-area-pb bg-background/80 backdrop-blur-xl border-t border-border/50 shadow-luxury">
            <div className="flex justify-around items-center h-16 max-w-md mx-auto px-3">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={cn(
                                "relative flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-200 group",
                                isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <div className={cn(
                                "relative flex items-center justify-center w-11 h-8 rounded-full transition-all duration-200",
                                isActive ? "bg-primary/12 text-primary shadow-2xs" : "group-hover:bg-muted/50"
                            )}>
                                <Icon className={cn(
                                    "w-5 h-5 transition-all duration-200",
                                    isActive ? "scale-110 text-primary" : "text-muted-foreground group-hover:scale-105"
                                )} />
                            </div>
                            <span className={cn(
                                "text-[10px] font-medium leading-tight mt-0.5 tracking-tight",
                                isActive ? "text-primary font-bold" : "text-muted-foreground"
                            )}>
                                {tab.label}
                            </span>
                            {isActive && (
                                <span className="absolute top-1 w-1 h-1 rounded-full bg-accent" />
                            )}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
