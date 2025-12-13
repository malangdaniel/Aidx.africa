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
        <div className="fixed bottom-0 left-0 right-0 z-50 glass-nav pb-safe">
            <div className="flex justify-around items-center h-16 max-w-md mx-auto">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-full transition-all duration-300 relative group",
                                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <div className={cn(
                                "absolute -top-1 w-8 h-1 rounded-b-lg bg-primary transition-all duration-300",
                                isActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
                            )} />

                            <Icon className={cn(
                                "w-6 h-6 transition-transform duration-300 mb-1",
                                isActive && "-translate-y-1"
                            )} />

                            <span className={cn(
                                "text-[10px] font-medium transition-all duration-300",
                                isActive ? "opacity-100 translate-y-0" : "opacity-70 translate-y-1"
                            )}>
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
