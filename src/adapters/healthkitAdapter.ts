/**
 * HealthKit Adapter — Stub for iOS native integration
 *
 * INTEGRATION PATH:
 * This web app requires a native bridge to access HealthKit.
 * Recommended approach: Add Capacitor (https://capacitorjs.com/) +
 * @capacitor-community/health-kit plugin.
 *
 * Steps:
 *  1. npm install @capacitor/core @capacitor/cli
 *  2. npx cap init && npx cap add ios
 *  3. npm install @capacitor-community/health-kit
 *  4. Request HealthKit permissions in Info.plist
 *  5. Replace stub functions below with actual Capacitor calls.
 *
 * For a web-only environment, this stub returns empty arrays gracefully.
 */

export interface HealthKitSample {
    metric: string;
    value: number;
    unit: string;
    timestamp: string;
    source: 'healthkit';
    confidence: number;
}

// Capacitor HealthKit types (provided by the plugin when installed)
// declare const HealthKit: any; // uncomment when Capacitor plugin is installed

export const HealthKitAdapter = {
    /**
     * Check whether HealthKit is available on this device.
     * On web, always returns false.
     */
    isAvailable(): boolean {
        // TODO: replace with: return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
        return false;
    },

    /**
     * Request HealthKit read permissions for the metrics we need.
     * TODO: implement with Capacitor HealthKit plugin when in native context.
     */
    async requestPermissions(): Promise<boolean> {
        if (!this.isAvailable()) {
            console.info('HealthKit: not available on this platform.');
            return false;
        }
        // TODO:
        // const result = await HealthKit.requestAuthorization({
        //   read: ['HeartRate', 'OxygenSaturation', 'RestingHeartRate', 'HeartRateVariabilitySDNN', 'SleepAnalysis', 'StepCount'],
        //   write: [],
        // });
        // return result.granted;
        return false;
    },

    /**
     * Fetch the last N hours of health data from HealthKit.
     * Returns normalized samples ready for EliteService.ingestVitals().
     */
    async fetchRecentSamples(hoursBack = 24): Promise<HealthKitSample[]> {
        if (!this.isAvailable()) return [];

        const startDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

        // TODO: Replace with actual Capacitor HealthKit calls, e.g.:
        //
        // const hrData = await HealthKit.queryHKitSampleType({
        //   sampleName: 'HeartRate',
        //   startDate,
        //   endDate: new Date().toISOString(),
        //   limit: 100,
        // });
        //
        // return hrData.resultData.map((sample: any) => ({
        //   metric: 'heart_rate',
        //   value: sample.value,
        //   unit: 'bpm',
        //   timestamp: sample.startDate,
        //   source: 'healthkit',
        //   confidence: 0.95,
        // }));

        console.info(`HealthKit: fetchRecentSamples called (stub). startDate=${startDate}`);
        return [];
    },

    /**
     * Fetch sleep analysis samples.
     * Returns sleep_hours as an aggregated value per night.
     */
    async fetchSleepData(): Promise<HealthKitSample[]> {
        if (!this.isAvailable()) return [];
        // TODO: Implement with HealthKit SleepAnalysis query
        return [];
    },
};
