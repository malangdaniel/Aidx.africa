/**
 * EliteApi — Client-side typed wrappers using TanStack Query v5 + Supabase.
 * Provides query and mutation hooks for all Elite Health Coach data.
 */

import {
    useQuery,
    useMutation,
    useQueryClient,
    type UseQueryResult,
} from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
    EliteService,
    type RawVital,
    type EliteScores,
    type EliteBaseline,
    type EliteAlert,
    type EliteVitalNormalized,
    type EliteClinicalPacket,
} from '@/services/EliteService';
import { useAuth } from '@/contexts/AuthContext';

// Query key factory for cache management
export const eliteKeys = {
    all: ['elite'] as const,
    scores: (userId: string, days: number) => ['elite', 'scores', userId, days] as const,
    baseline: (userId: string) => ['elite', 'baseline', userId] as const,
    alerts: (userId: string) => ['elite', 'alerts', userId] as const,
    vitals: (userId: string, days: number) => ['elite', 'vitals', userId, days] as const,
};

// ---------------------------------------------------------------------------
// useLatestScores
// ---------------------------------------------------------------------------
export function useLatestScores(days = 7): UseQueryResult<EliteScores[]> {
    const { user } = useAuth();
    return useQuery({
        queryKey: eliteKeys.scores(user?.id ?? '', days),
        queryFn: () => EliteService.getLatestScores(user!.id, days),
        enabled: !!user,
        staleTime: 5 * 60 * 1000,  // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes
        retry: 2,
    });
}

// ---------------------------------------------------------------------------
// useBaseline
// ---------------------------------------------------------------------------
export function useBaseline(): UseQueryResult<EliteBaseline[]> {
    const { user } = useAuth();
    return useQuery({
        queryKey: eliteKeys.baseline(user?.id ?? ''),
        queryFn: () => EliteService.getBaseline(user!.id),
        enabled: !!user,
        staleTime: 10 * 60 * 1000,
    });
}

// ---------------------------------------------------------------------------
// useActiveAlerts
// ---------------------------------------------------------------------------
export function useActiveAlerts(): UseQueryResult<EliteAlert[]> {
    const { user } = useAuth();
    return useQuery({
        queryKey: eliteKeys.alerts(user?.id ?? ''),
        queryFn: () => EliteService.getActiveAlerts(user!.id),
        enabled: !!user,
        staleTime: 2 * 60 * 1000,
        refetchInterval: 5 * 60 * 1000, // auto-refresh every 5 min
    });
}

// ---------------------------------------------------------------------------
// useRecentNormalizedVitals
// ---------------------------------------------------------------------------
export function useRecentNormalizedVitals(days = 7): UseQueryResult<EliteVitalNormalized[]> {
    const { user } = useAuth();
    return useQuery({
        queryKey: eliteKeys.vitals(user?.id ?? '', days),
        queryFn: () => EliteService.getRecentNormalizedVitals(user!.id, days),
        enabled: !!user,
        staleTime: 5 * 60 * 1000,
    });
}

// ---------------------------------------------------------------------------
// useIngestVitals — mutation
// ---------------------------------------------------------------------------
export function useIngestVitals() {
    const { user } = useAuth();
    const qc = useQueryClient();

    return useMutation({
        mutationFn: (vitals: RawVital[]) => EliteService.ingestVitals(user!.id, vitals),
        onSuccess: async () => {
            // Invalidate scores + vitals cache, then recompute scores
            await qc.invalidateQueries({ queryKey: eliteKeys.all });
            if (user) {
                // Non-blocking: compute scores after ingestion
                EliteService.computeAndStoreScores(user.id).catch(console.error);
            }
        },
    });
}

// ---------------------------------------------------------------------------
// useResolveAlert — mutation
// ---------------------------------------------------------------------------
export function useResolveAlert() {
    const { user } = useAuth();
    const qc = useQueryClient();

    return useMutation({
        mutationFn: (alertId: string) => EliteService.resolveAlert(alertId),
        onSuccess: () => {
            if (user) qc.invalidateQueries({ queryKey: eliteKeys.alerts(user.id) });
        },
    });
}

// ---------------------------------------------------------------------------
// useGenerateClinicalPacket — mutation (generates + returns packet)
// ---------------------------------------------------------------------------
export function useGenerateClinicalPacket() {
    const { user } = useAuth();

    return useMutation({
        mutationFn: (scoreId?: string): Promise<EliteClinicalPacket> =>
            EliteService.generateClinicalPacket(user!.id, scoreId),
    });
}

// ---------------------------------------------------------------------------
// useComputeScores — mutation (trigger on-demand score computation)
// ---------------------------------------------------------------------------
export function useComputeScores() {
    const { user } = useAuth();
    const qc = useQueryClient();

    return useMutation({
        mutationFn: () => EliteService.computeAndStoreScores(user!.id),
        onSuccess: () => {
            if (user) {
                qc.invalidateQueries({ queryKey: eliteKeys.scores(user.id, 7) });
                qc.invalidateQueries({ queryKey: eliteKeys.alerts(user.id) });
            }
        },
    });
}

// ---------------------------------------------------------------------------
// useEliteEnabled — reads the feature flag
// ---------------------------------------------------------------------------
export function useEliteEnabled(): boolean {
    return import.meta.env.VITE_ELITE_ENABLED === 'true';
}

// ---------------------------------------------------------------------------
// useEliteIngestEdge — uses the Supabase edge function for ingestion
// (alternative to direct Supabase client; preferred for production)
// ---------------------------------------------------------------------------
export function useIngestVitalsEdge() {
    const { user } = useAuth();
    const qc = useQueryClient();

    return useMutation({
        mutationFn: async (vitals: RawVital[]) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Not authenticated');

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const res = await fetch(`${supabaseUrl}/functions/v1/elite_ingest`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ vitals }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(err.error ?? 'Ingestion failed');
            }
            return res.json();
        },
        onSuccess: () => {
            if (user) qc.invalidateQueries({ queryKey: eliteKeys.all });
        },
    });
}
