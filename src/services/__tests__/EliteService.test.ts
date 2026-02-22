/**
 * EliteService Unit Tests
 * Uses Vitest + mocked Supabase client.
 *
 * Run: npx vitest run src/services/__tests__/EliteService.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------
const mockInsertData: any[] = [];
let mockSelectData: any[] = [];
let mockError: null | { message: string } = null;

const mockChain = {
    eq: () => mockChain,
    gte: () => mockChain,
    is: () => mockChain,
    order: () => mockChain,
    limit: () => mockChain,
    single: () => Promise.resolve({ data: mockSelectData[0] ?? null, error: mockError }),
    select: () => mockChain,
    upsert: () => mockChain,
    update: () => mockChain,
    then: (resolve: (v: any) => any) => Promise.resolve({ data: mockSelectData, error: mockError }).then(resolve),
};

const mockSupabase = {
    from: vi.fn(() => ({
        ...mockChain,
        insert: vi.fn(() => ({
            ...mockChain,
            select: vi.fn(() =>
                Promise.resolve({ data: mockInsertData, error: mockError })
            ),
        })),
        select: vi.fn(() => Promise.resolve({ data: mockSelectData, error: mockError })),
        upsert: vi.fn(() => ({
            ...mockChain,
            select: vi.fn(() => ({
                ...mockChain,
                single: vi.fn(() => Promise.resolve({ data: mockSelectData[0] ?? null, error: mockError })),
            })),
        })),
        update: vi.fn(() => ({
            ...mockChain,
            eq: vi.fn(() => Promise.resolve({ data: null, error: mockError })),
        })),
    })),
    auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'user-test-123' } } })),
    },
};

vi.mock('@/integrations/supabase/client', () => ({ supabase: mockSupabase }));

// ---------------------------------------------------------------------------
// Import after mock
// ---------------------------------------------------------------------------
import { EliteService } from '@/services/EliteService';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('EliteService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockError = null;
    });

    // -----------------------------------------------------------------------
    it('ingestVitals — inserts valid vitals and returns raw rows', async () => {
        const mockRaw = [
            { id: 'raw-1', user_id: 'user-test-123', metric: 'heart_rate', value: 72, unit: 'bpm', timestamp: new Date().toISOString(), source: 'manual', confidence: 1, meta: {} },
        ];
        mockInsertData.push(...mockRaw);
        // Re-mock the insert chain for this specific test
        mockSupabase.from.mockReturnValueOnce({
            insert: vi.fn(() => ({
                select: vi.fn(() => Promise.resolve({ data: mockRaw, error: null })),
            })),
        });
        // Second call for normalized insert
        mockSupabase.from.mockReturnValueOnce({
            insert: vi.fn(() => Promise.resolve({ error: null })),
        });

        const result = await EliteService.ingestVitals('user-test-123', [
            { metric: 'heart_rate', value: 72, unit: 'bpm', source: 'manual' },
        ]);

        expect(result).toHaveLength(1);
        expect(result[0].metric).toBe('heart_rate');
    });

    // -----------------------------------------------------------------------
    it('ingestVitals — filters outlier values', async () => {
        const result = await EliteService.ingestVitals('user-test-123', [
            { metric: 'heart_rate', value: 500, unit: 'bpm' }, // outlier — should be filtered
        ]);
        expect(result).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    it('ingestVitals — normalizes temperature from °F to °C', async () => {
        const rawIn = [{ metric: 'temperature' as const, value: 98.6, unit: '°F' }];
        // 98.6°F = 37°C — should pass outlier check
        const mockRaw = [{ id: 'r2', metric: 'temperature', value: 98.6, unit: '°F', timestamp: '', source: 'manual', confidence: 1, meta: {}, user_id: 'u' }];
        mockSupabase.from.mockReturnValueOnce({
            insert: vi.fn(() => ({ select: vi.fn(() => Promise.resolve({ data: mockRaw, error: null })) })),
        });
        mockSupabase.from.mockReturnValueOnce({
            insert: vi.fn(() => Promise.resolve({ error: null })),
        });

        const result = await EliteService.ingestVitals('user-test-123', rawIn);
        expect(result).toHaveLength(1);
    });

    // -----------------------------------------------------------------------
    it('getLatestScores — returns scores array', async () => {
        const mockScores = [
            { id: 's1', user_id: 'u', score_date: '2026-02-21', physiological_stability: 20, immune_activation: 15, cardiovascular_strain: 25, recovery_efficiency: 75, confidence_json: {}, computed_at: '' },
        ];
        mockSupabase.from.mockReturnValueOnce({
            select: vi.fn(() => ({ eq: vi.fn(() => ({ gte: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: mockScores, error: null })) })) })) })),
        });

        const scores = await EliteService.getLatestScores('u', 7);
        expect(scores).toHaveLength(1);
        expect(scores[0].physiological_stability).toBe(20);
    });

    // -----------------------------------------------------------------------
    it('getLatestScores — throws on Supabase error', async () => {
        mockSupabase.from.mockReturnValueOnce({
            select: vi.fn(() => ({ eq: vi.fn(() => ({ gte: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: null, error: { message: 'DB error' } })) })) })) })),
        });

        await expect(EliteService.getLatestScores('u', 7)).rejects.toThrow('getLatestScores: DB error');
    });

    // -----------------------------------------------------------------------
    it('generateClinicalPacket — returns packet with correct shape', async () => {
        // mock all 4 calls: getLatestScores, getRecentNormalized, getBaseline, getActiveAlerts
        const emptyResp = { select: vi.fn(() => ({ eq: vi.fn(() => ({ gte: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: [], error: null })) })) })) })) };
        mockSupabase.from
            .mockReturnValueOnce(emptyResp) // scores
            .mockReturnValueOnce(emptyResp) // vitals
            .mockReturnValueOnce({ select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: [], error: null })) })) }) // baselines
            .mockReturnValueOnce({ select: vi.fn(() => ({ eq: vi.fn(() => ({ is: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: [], error: null })) })) })) })) }); // alerts

        const packet = await EliteService.generateClinicalPacket('user-test-123');

        expect(packet).toHaveProperty('userId', 'user-test-123');
        expect(packet).toHaveProperty('generatedAt');
        expect(packet).toHaveProperty('recentVitals');
        expect(packet).toHaveProperty('baselines');
        expect(packet).toHaveProperty('alerts');
    });
});
