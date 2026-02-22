/**
 * EliteDashboard Component Tests
 * Run: npx vitest run src/components/elite/__tests__/EliteDashboard.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 'test-user' }, profile: { first_name: 'Test' } }),
}));

const mockScores = [
    {
        id: 'score-1',
        user_id: 'test-user',
        score_date: '2026-02-21',
        physiological_stability: 22,
        immune_activation: 30,
        cardiovascular_strain: 18,
        recovery_efficiency: 80,
        confidence_json: {
            physiological_stability: 0.85,
            immune_activation: 0.80,
            cardiovascular_strain: 0.85,
            recovery_efficiency: 0.80,
        },
        computed_at: new Date().toISOString(),
    },
];

vi.mock('@/services/elite/EliteApi', () => ({
    useLatestScores: () => ({ data: mockScores, isLoading: false, isError: false }),
    useActiveAlerts: () => ({ data: [], isLoading: false }),
    useRecentNormalizedVitals: () => ({ data: [], isLoading: false }),
    useResolveAlert: () => ({ mutate: vi.fn() }),
    useComputeScores: () => ({ mutate: vi.fn(), isPending: false }),
    useGenerateClinicalPacket: () => ({ mutateAsync: vi.fn().mockResolvedValue({ generatedAt: '', alerts: [] }) }),
}));

vi.mock('@/hooks/useEliteVitals', () => ({
    useEliteVitals: () => ({
        scores: mockScores,
        baseline: [],
        alerts: [],
        vitals: [],
        isLoading: false,
        isError: false,
        ingestVitals: vi.fn().mockResolvedValue(undefined),
        isIngesting: false,
        syncWearable: vi.fn().mockResolvedValue({ synced: 0, source: 'none' }),
        isSyncing: false,
        startOnDeviceCollector: vi.fn(),
        stopOnDeviceCollector: vi.fn(),
        isCollecting: false,
    }),
}));

vi.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: vi.fn(() => ({
        getGenerativeModel: vi.fn(() => ({
            generateContent: vi.fn().mockResolvedValue({
                response: { text: () => 'Mocked AI insight for testing.' },
            }),
        })),
    })),
}));

vi.mock('@/services/ConsultationService', () => ({
    ConsultationService: { openFromElite: vi.fn().mockResolvedValue({ consultationId: null }) },
}));

import EliteDashboard from '@/components/elite/EliteDashboard';

describe('EliteDashboard', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('renders brand header', () => {
        render(<EliteDashboard />);
        expect(screen.getByText('AiDx Elite')).toBeInTheDocument();
        expect(screen.getByText('Premium Health Coach')).toBeInTheDocument();
    });

    it('renders all 4 score index labels', () => {
        render(<EliteDashboard />);
        expect(screen.getByText('Stability')).toBeInTheDocument();
        expect(screen.getByText('Immune')).toBeInTheDocument();
        expect(screen.getByText('Cardio')).toBeInTheDocument();
        expect(screen.getByText('Recovery')).toBeInTheDocument();
    });

    it('renders score values from mock data', () => {
        render(<EliteDashboard />);
        expect(screen.getByText('22')).toBeInTheDocument(); // physiological_stability
        expect(screen.getByText('30')).toBeInTheDocument(); // immune_activation
    });

    it('does NOT show alert banner when no alerts', () => {
        render(<EliteDashboard />);
        expect(screen.queryByText(/Attention Required/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Health Notice/)).not.toBeInTheDocument();
    });

    it('shows Advanced Metrics section on toggle click', async () => {
        render(<EliteDashboard />);
        const toggle = screen.getByText('Advanced Metrics');
        await userEvent.click(toggle);
        expect(screen.getByText('7-Day Vital Trends')).toBeInTheDocument();
    });

    it('shows vitals entry form on toggle click', async () => {
        render(<EliteDashboard />);
        const toggle = screen.getByText('Log Vitals Manually');
        await userEvent.click(toggle);
        expect(screen.getByText(/Heart Rate/)).toBeInTheDocument();
    });
});
