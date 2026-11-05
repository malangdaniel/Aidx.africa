import { useEffect, useState } from 'react';
import { Loader2, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface AccessEntry {
    id: string;
    doctor_id: string;
    doctor_name: string;
    hospital_or_clinic: string | null;
    accessed_at: string;
    sections: string[];
}

const SECTION_LABELS: Record<string, string> = {
    profile: 'Profile',
    health_history: 'Health history',
    consultations: 'Consultations',
    vitals: 'Vitals',
    ai_diagnoses: 'AI diagnoses',
    prescriptions: 'Prescriptions',
    lab_orders: 'Lab orders',
};

/** Shows the patient every time a doctor opened their record. */
export default function RecordAccessLog() {
    const [entries, setEntries] = useState<AccessEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const { data, error } = await (supabase.rpc as any)('get_my_record_access_log', { p_limit: 50 });
                if (error) throw error;
                setEntries((data || []) as AccessEntry[]);
            } catch (e) {
                console.error('Failed to load record access log:', e);
                setError(true);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return <p className="text-sm text-muted-foreground">Could not load your access history right now.</p>;
    }

    if (entries.length === 0) {
        return (
            <div className="text-center py-6 text-muted-foreground">
                <Eye className="w-7 h-7 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No doctor has opened your record yet.</p>
            </div>
        );
    }

    return (
        <div className="divide-y">
            {entries.map((e) => (
                <div key={e.id} className="py-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">
                            {e.doctor_name.startsWith('Dr') ? e.doctor_name : `Dr. ${e.doctor_name}`}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                            {new Date(e.accessed_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    {e.hospital_or_clinic && <p className="text-xs text-muted-foreground">{e.hospital_or_clinic}</p>}
                    <div className="flex flex-wrap gap-1">
                        {e.sections.map((s) => (
                            <Badge key={s} variant="outline" className="text-[10px] font-normal">
                                {SECTION_LABELS[s] || s}
                            </Badge>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
