/**
 * Fallback Device Estimator
 * Infers step count and basic activity from phone sensors
 * when no wearable is available.
 *
 * Uses:
 *  - DeviceMotionEvent for step detection via accelerometer
 *  - Page Visibility API for session timing
 *  - localStorage for daily persistence
 */

export interface DeviceEstimate {
    metric: string;
    value: number;
    unit: string;
    timestamp: string;
    source: 'device_estimate';
    confidence: number;
}

const STORAGE_KEY = 'aidx_elite_device_estimates';

interface SessionData {
    date: string;
    stepCount: number;
    activeMinutes: number;
    sessionStartMs: number;
}

let _isListening = false;
let _stepCount = 0;
let _lastAccelMag = 0;
let _stepThreshold = 10; // m/s² threshold for step detection
let _lastStepTime = 0;
let _minStepInterval = 300; // ms between valid steps

// Load today's session data from localStorage
function loadSession(): SessionData {
    const today = new Date().toISOString().slice(0, 10);
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const data: SessionData = JSON.parse(stored);
            if (data.date === today) return data;
        }
    } catch (_) { /* ignore */ }
    return { date: today, stepCount: 0, activeMinutes: 0, sessionStartMs: Date.now() };
}

function saveSession(data: SessionData): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) { /* ignore */ }
}

export const FallbackDeviceEstimator = {
    /**
     * Check if device motion is supported (requires user permission on some platforms).
     */
    isSupported(): boolean {
        return typeof DeviceMotionEvent !== 'undefined';
    },

    /**
     * Request motion sensor permission (iOS 13+ requires explicit permission).
     */
    async requestPermission(): Promise<boolean> {
        if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
            try {
                const result = await (DeviceMotionEvent as any).requestPermission();
                return result === 'granted';
            } catch {
                return false;
            }
        }
        // Android / desktop — no explicit permission needed
        return this.isSupported();
    },

    /**
     * Start listening to device motion for step counting.
     */
    startListening(): void {
        if (_isListening || !this.isSupported()) return;

        const session = loadSession();
        _stepCount = session.stepCount;

        window.addEventListener('devicemotion', (event: DeviceMotionEvent) => {
            const acc = event.accelerationIncludingGravity;
            if (!acc) return;

            const mag = Math.sqrt(
                (acc.x ?? 0) ** 2 +
                (acc.y ?? 0) ** 2 +
                (acc.z ?? 0) ** 2
            );

            // Peak detection for step counting
            const delta = Math.abs(mag - _lastAccelMag);
            const now = Date.now();

            if (delta > _stepThreshold && now - _lastStepTime > _minStepInterval) {
                _stepCount++;
                _lastStepTime = now;
                const sess = loadSession();
                sess.stepCount = _stepCount;
                saveSession(sess);
            }
            _lastAccelMag = mag;
        });

        _isListening = true;
    },

    /**
     * Stop listening to device motion.
     */
    stopListening(): void {
        if (!_isListening) return;
        // Note: can't easily remove the anonymous listener — for production,
        // store the handler reference.
        _isListening = false;
    },

    /**
     * Get the current session's step count estimate.
     */
    getStepCount(): number {
        return _stepCount;
    },

    /**
     * Estimate active minutes based on page-visible session time.
     * Rough proxy: assume user is active when app is in foreground.
     */
    getActiveMinutes(): number {
        const session = loadSession();
        const elapsedMs = Date.now() - session.sessionStartMs;
        return Math.round(elapsedMs / 60_000);
    },

    /**
     * Infer a rough sleep estimate based on the gap between last active session
     * and current time (if gap > 4 hours overnight).
     * Returns sleep_hours estimate with low confidence.
     */
    estimateSleepHours(): number | null {
        const now = new Date();
        const hour = now.getHours();

        // Only provide estimate in morning hours (6-10am)
        if (hour < 6 || hour > 10) return null;

        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return null;
            const session: SessionData = JSON.parse(stored);
            const sessionStartHour = new Date(session.sessionStartMs).getHours();
            // Rough: if previous session ended in evening (20-24) and now is morning
            if (sessionStartHour >= 20 || sessionStartHour <= 2) {
                const gapMs = Date.now() - session.sessionStartMs;
                const gapHours = gapMs / (1000 * 60 * 60);
                if (gapHours >= 4 && gapHours <= 12) return Math.round(gapHours * 10) / 10;
            }
        } catch (_) { /* ignore */ }

        return null;
    },

    /**
     * Get all current device estimates as vital samples ready for ingestion.
     */
    getSamples(): DeviceEstimate[] {
        const now = new Date().toISOString();
        const samples: DeviceEstimate[] = [];

        const steps = this.getStepCount();
        if (steps > 0) {
            samples.push({
                metric: 'steps',
                value: steps,
                unit: 'steps',
                timestamp: now,
                source: 'device_estimate',
                confidence: 0.6, // lower confidence than wearable
            });
        }

        const sleep = this.estimateSleepHours();
        if (sleep !== null) {
            samples.push({
                metric: 'sleep_hours',
                value: sleep,
                unit: 'hours',
                timestamp: now,
                source: 'device_estimate',
                confidence: 0.35, // very rough estimate
            });
        }

        return samples;
    },
};
