/**
 * AICoachCard Component Tests
 * Run: npx vitest run src/components/elite/__tests__/AICoachCard.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mock TanStack Query hooks
// ---------------------------------------------------------------------------
vi.mock('@/services/elite/EliteApi', () => ({
    useLatestScores: () => ({
        data: undefined,
        isLoading: false,
    }),
    useActiveAlerts: () => ({
        data: undefined,
        isLoading: false,
    }),
}));

vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({ user: { id: 'test-user' } }),
}));

import AICoachCard from '@/components/elite/AICoachCard';

describe('AICoachCard', () => {
    const onOpen = vi.fn();

    beforeEach(() => { vi.clearAllMocks(); });

    it('renders the card with brand label', () => {
        render(<AICoachCard insight={null} onOpenDashboard={onOpen} />);
        expect(screen.getByText('AiDx Elite')).toBeInTheDocument();
        expect(screen.getByText('Health Coach')).toBeInTheDocument();
    });

    it('shows the insight text when provided', () => {
        render(<AICoachCard insight="Your heart rate looks steady today." onOpenDashboard={onOpen} />);
        expect(screen.getByText(/heart rate looks steady/)).toBeInTheDocument();
    });

    it('shows placeholder text when no insight', () => {
        render(<AICoachCard insight={null} onOpenDashboard={onOpen} />);
        expect(screen.getByText(/Tap to open/)).toBeInTheDocument();
    });

    it('shows loading indicator when isLoadingInsight is true', () => {
        render(<AICoachCard insight={null} isLoadingInsight onOpenDashboard={onOpen} />);
        // Skeletons rendered (no text)
        expect(screen.queryByText(/Tap to open/)).not.toBeInTheDocument();
    });

    it('renders without crash when scores are undefined', () => {
        expect(() => render(<AICoachCard insight="ok" onOpenDashboard={onOpen} />)).not.toThrow();
    });
});
