/**
 * Google Fit Adapter — Web-compatible REST API implementation
 *
 * Uses the Google Fitness REST API (OAuth2), which works in web browsers.
 * Users must authenticate with Google and grant fitness data scopes.
 *
 * Auth Scope: https://www.googleapis.com/auth/fitness.activity.read
 *             https://www.googleapis.com/auth/fitness.heart_rate.read
 *             https://www.googleapis.com/auth/fitness.sleep.read
 *
 * SETUP:
 *  1. Create a Google Cloud Project & enable Fitness API.
 *  2. Create OAuth 2.0 credentials (Web Application type).
 *  3. Add VITE_GOOGLE_FIT_CLIENT_ID to your .env.
 *  4. Implement OAuth2 flow (use Google Identity Services library or GIS).
 */

const FIT_API_BASE = 'https://www.googleapis.com/fitness/v1/users/me';

export interface GoogleFitSample {
    metric: string;
    value: number;
    unit: string;
    timestamp: string;
    source: 'google_fit';
    confidence: number;
}

// In-memory token store (replace with proper OAuth session management)
let _accessToken: string | null = null;

export const GoogleFitAdapter = {
    /**
     * Set the OAuth2 access token (call after completed OAuth flow).
     */
    setAccessToken(token: string): void {
        _accessToken = token;
    },

    /**
     * Check whether we have a valid access token.
     */
    isAuthenticated(): boolean {
        return _accessToken !== null;
    },

    /**
     * Initiate Google OAuth2 flow.
     * Redirects the user to Google consent screen.
     * After consent, call setAccessToken() with the returned token.
     */
    initiateOAuthFlow(): void {
        const clientId = import.meta.env.VITE_GOOGLE_FIT_CLIENT_ID;
        if (!clientId) {
            console.error('GoogleFitAdapter: VITE_GOOGLE_FIT_CLIENT_ID not set.');
            return;
        }

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: `${window.location.origin}/integrations/google-fit/callback`,
            response_type: 'token',
            scope: [
                'https://www.googleapis.com/auth/fitness.activity.read',
                'https://www.googleapis.com/auth/fitness.heart_rate.read',
                'https://www.googleapis.com/auth/fitness.sleep.read',
                'https://www.googleapis.com/auth/fitness.body.read',
            ].join(' '),
        });

        window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    },

    /**
     * Fetch heart rate data from Google Fit.
     */
    async fetchHeartRate(hoursBack = 24): Promise<GoogleFitSample[]> {
        if (!_accessToken) return [];

        const endMs = Date.now();
        const startMs = endMs - hoursBack * 60 * 60 * 1000;

        try {
            const res = await fetch(
                `${FIT_API_BASE}/dataset:aggregate`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${_accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        aggregateBy: [{ dataTypeName: 'com.google.heart_rate.bpm' }],
                        bucketByTime: { durationMillis: 3600000 }, // 1-hour buckets
                        startTimeMillis: startMs,
                        endTimeMillis: endMs,
                    }),
                }
            );

            if (!res.ok) {
                console.error('GoogleFit fetchHeartRate error:', await res.text());
                return [];
            }

            const json = await res.json();
            const samples: GoogleFitSample[] = [];

            for (const bucket of (json.bucket ?? [])) {
                for (const dataset of (bucket.dataset ?? [])) {
                    for (const point of (dataset.point ?? [])) {
                        const val = point.value?.[0]?.fpVal;
                        if (val != null) {
                            samples.push({
                                metric: 'heart_rate',
                                value: Math.round(val),
                                unit: 'bpm',
                                timestamp: new Date(parseInt(point.startTimeNanos) / 1e6).toISOString(),
                                source: 'google_fit',
                                confidence: 0.9,
                            });
                        }
                    }
                }
            }

            return samples;
        } catch (err) {
            console.error('GoogleFitAdapter.fetchHeartRate error:', err);
            return [];
        }
    },

    /**
     * Fetch step count from Google Fit.
     */
    async fetchSteps(hoursBack = 24): Promise<GoogleFitSample[]> {
        if (!_accessToken) return [];

        const endMs = Date.now();
        const startMs = endMs - hoursBack * 60 * 60 * 1000;

        try {
            const res = await fetch(`${FIT_API_BASE}/dataset:aggregate`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${_accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }],
                    bucketByTime: { durationMillis: 86400000 }, // daily bucket
                    startTimeMillis: startMs,
                    endTimeMillis: endMs,
                }),
            });

            if (!res.ok) return [];
            const json = await res.json();
            const samples: GoogleFitSample[] = [];

            for (const bucket of (json.bucket ?? [])) {
                let total = 0;
                for (const ds of (bucket.dataset ?? [])) {
                    for (const point of (ds.point ?? [])) {
                        total += point.value?.[0]?.intVal ?? 0;
                    }
                }
                if (total > 0) {
                    samples.push({
                        metric: 'steps',
                        value: total,
                        unit: 'steps',
                        timestamp: new Date(parseInt(bucket.startTimeMillis)).toISOString(),
                        source: 'google_fit',
                        confidence: 0.95,
                    });
                }
            }

            return samples;
        } catch (err) {
            console.error('GoogleFitAdapter.fetchSteps error:', err);
            return [];
        }
    },

    /**
     * Fetch all supported metrics and combine into one batch for ingestion.
     */
    async fetchAllMetrics(hoursBack = 24): Promise<GoogleFitSample[]> {
        const [hr, steps] = await Promise.all([
            this.fetchHeartRate(hoursBack),
            this.fetchSteps(hoursBack),
        ]);
        return [...hr, ...steps];
    },
};
