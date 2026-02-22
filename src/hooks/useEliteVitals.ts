/**
 * useEliteVitals — composite hook aggregating all Elite Health Coach data sources.
 * Combines EliteApi hooks, wearable adapter sync, and on-device fallback.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
    useLatestScores,
    useBaseline,
    useActiveAlerts,
    useRecentNormalizedVitals,
    useIngestVitals,
} from '@/services/elite/EliteApi';
import { GoogleFitAdapter } from '@/adapters/googleFitAdapter';
import { HealthKitAdapter } from '@/adapters/healthkitAdapter';
import { FallbackDeviceEstimator } from '@/adapters/fallbackDeviceEstimator';
import type { RawVital } from '@/services/EliteService';

export interface UseEliteVitalsReturn {
    // Data
    scores: ReturnType<typeof useLatestScores>['data'];
    baseline: ReturnType<typeof useBaseline>['data'];
    alerts: ReturnType<typeof useActiveAlerts>['data'];
    vitals: ReturnType<typeof useRecentNormalizedVitals>['data'];

    // Loading / error states
    isLoading: boolean;
    isError: boolean;

    // Actions
    ingestVitals: (vitals: RawVital[]) => Promise<void>;
    isIngesting: boolean;
    syncWearable: () => Promise<{ synced: number; source: string }>;
    isSyncing: boolean;
    startOnDeviceCollector: () => void;
    stopOnDeviceCollector: () => void;
    isCollecting: boolean;
}

export function useEliteVitals(): UseEliteVitalsReturn {
    const { user } = useAuth();

    const scoresQuery = useLatestScores(7);
    const baselineQuery = useBaseline();
    const alertsQuery = useActiveAlerts();
    const vitalsQuery = useRecentNormalizedVitals(7);

    const ingestMutation = useIngestVitals();
    const isSyncingRef = useRef(false);
    const isCollectingRef = useRef(false);

    // Start on-device sensor collection on mount (non-blocking)
    useEffect(() => {
        if (FallbackDeviceEstimator.isSupported() && !isCollectingRef.current) {
            FallbackDeviceEstimator.requestPermission().then(granted => {
                if (granted) {
                    FallbackDeviceEstimator.startListening();
                    isCollectingRef.current = true;
                }
            });
        }
        return () => {
            if (isCollectingRef.current) {
                FallbackDeviceEstimator.stopListening();
                isCollectingRef.current = false;
            }
        };
    }, []);

    const ingestVitals = useCallback(async (vitals: RawVital[]) => {
        await ingestMutation.mutateAsync(vitals);
    }, [ingestMutation]);

    /**
     * Attempt to sync from the best available wearable source.
     * Priority: HealthKit → Google Fit → Device Estimator
     */
    const syncWearable = useCallback(async (): Promise<{ synced: number; source: string }> => {
        if (isSyncingRef.current) return { synced: 0, source: 'none' };
        isSyncingRef.current = true;

        try {
            // 1. HealthKit (iOS native — stub in web context)
            if (HealthKitAdapter.isAvailable()) {
                const granted = await HealthKitAdapter.requestPermissions();
                if (granted) {
                    const samples = await HealthKitAdapter.fetchRecentSamples(24);
                    if (samples.length > 0) {
                        await ingestMutation.mutateAsync(samples as RawVital[]);
                        return { synced: samples.length, source: 'healthkit' };
                    }
                }
            }

            // 2. Google Fit (web-compatible)
            if (GoogleFitAdapter.isAuthenticated()) {
                const samples = await GoogleFitAdapter.fetchAllMetrics(24);
                if (samples.length > 0) {
                    await ingestMutation.mutateAsync(samples as RawVital[]);
                    return { synced: samples.length, source: 'google_fit' };
                }
            }

            // 3. Device estimator fallback
            const deviceSamples = FallbackDeviceEstimator.getSamples();
            if (deviceSamples.length > 0) {
                await ingestMutation.mutateAsync(deviceSamples as RawVital[]);
                return { synced: deviceSamples.length, source: 'device_estimate' };
            }

            return { synced: 0, source: 'none' };
        } finally {
            isSyncingRef.current = false;
        }
    }, [ingestMutation]);

    const startOnDeviceCollector = useCallback(async () => {
        const granted = await FallbackDeviceEstimator.requestPermission();
        if (granted) {
            FallbackDeviceEstimator.startListening();
            isCollectingRef.current = true;
        }
    }, []);

    const stopOnDeviceCollector = useCallback(() => {
        FallbackDeviceEstimator.stopListening();
        isCollectingRef.current = false;
    }, []);

    return {
        scores: scoresQuery.data,
        baseline: baselineQuery.data,
        alerts: alertsQuery.data,
        vitals: vitalsQuery.data,

        isLoading: scoresQuery.isLoading || baselineQuery.isLoading || alertsQuery.isLoading,
        isError: scoresQuery.isError || baselineQuery.isError || alertsQuery.isError,

        ingestVitals,
        isIngesting: ingestMutation.isPending,

        syncWearable,
        isSyncing: isSyncingRef.current,

        startOnDeviceCollector,
        stopOnDeviceCollector,
        isCollecting: isCollectingRef.current,
    };
}
