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
        <nav className="fixed bottom-0 left-0 right-0 z-50 glass-nav md:hidden safe-area-pb">
            <div className="flex justify-around items-center h-14 max-w-md mx-auto px-1">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={cn(
                                "flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-200",
                                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <div className={cn(
                                "flex items-center justify-center w-10 h-8 rounded-lg transition-all duration-200",
                                isActive && "bg-primary/10"
                            )}>
                                <Icon className={cn(
                                    "w-5 h-5 transition-transform duration-200",
                                    isActive && "scale-110"
                                )} />
                            </div>
                            <span className={cn(
                                "text-[10px] font-medium leading-tight",
                                isActive && "text-primary"
                            )}>
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
