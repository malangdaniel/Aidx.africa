export const DAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Normalizes an array of raw day strings into unique day indices (0-6).
 */
export function getCanonicalAvailableDays(rawDays?: string[]): number[] {
  if (!rawDays || rawDays.length === 0) {
    // Default to weekdays Mon-Fri if no days explicitly saved
    return [1, 2, 3, 4, 5];
  }

  const indices = new Set<number>();
  for (const dayStr of rawDays) {
    if (!dayStr) continue;
    const clean = dayStr.trim().toLowerCase();
    if (DAY_MAP[clean] !== undefined) {
      indices.add(DAY_MAP[clean]);
    } else {
      // Try matching by prefix (e.g. "thurs" -> "thu")
      const matched = Object.keys(DAY_MAP).find(k => clean.startsWith(k));
      if (matched !== undefined) {
        indices.add(DAY_MAP[matched]);
      }
    }
  }

  return indices.size > 0 ? Array.from(indices).sort((a, b) => a - b) : [1, 2, 3, 4, 5];
}

/**
 * Checks if a specific date falls on one of the doctor's available days.
 */
export function isDayAvailableForDoctor(date: Date, rawDays?: string[]): boolean {
  const canonicalDays = getCanonicalAvailableDays(rawDays);
  return canonicalDays.includes(date.getDay());
}

/**
 * Formats a 24-hour time string (e.g., "09:00", "17:00") into 12-hour AM/PM format.
 */
export function formatTime12(timeStr?: string, fallback: string = '09:00 AM'): string {
  if (!timeStr) return fallback;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${ampm}`;
}

/**
 * Formats raw days array into a human readable schedule string (e.g. "Mon - Fri" or "Mon, Wed, Fri").
 */
export function formatAvailableDaysList(rawDays?: string[]): string {
  const canonical = getCanonicalAvailableDays(rawDays);
  if (canonical.length === 5 && canonical.join(',') === '1,2,3,4,5') {
    return 'Mon - Fri';
  }
  if (canonical.length === 7) {
    return 'Everyday';
  }
  if (canonical.length === 2 && canonical.join(',') === '0,6') {
    return 'Weekends Only';
  }
  return canonical.map(idx => DAY_NAMES_SHORT[idx]).join(', ');
}

/**
 * Calculates the exact real next available date & time label based on doctor's schedule.
 */
export function computeRealNextAvailable(
  rawDays?: string[],
  startStr: string = '09:00',
  endStr: string = '17:00'
): string {
  const canonicalDays = getCanonicalAvailableDays(rawDays);
  const now = new Date();
  const currentDayIndex = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Parse start/end minutes
  const startMatch = startStr.match(/^(\d{1,2}):(\d{2})/);
  const endMatch = endStr.match(/^(\d{1,2}):(\d{2})/);

  const startMinutes = startMatch ? parseInt(startMatch[1], 10) * 60 + parseInt(startMatch[2], 10) : 9 * 60;
  const endMinutes = endMatch ? parseInt(endMatch[1], 10) * 60 + parseInt(endMatch[2], 10) : 17 * 60;

  const startFormatted = formatTime12(startStr, '9:00 AM');

  // Check next 7 days
  for (let offset = 0; offset < 7; offset++) {
    const checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const dayIndex = checkDate.getDay();

    if (!canonicalDays.includes(dayIndex)) continue;

    if (offset === 0) {
      // Today: check if working hours end is at least 30 minutes in the future
      if (currentMinutes < endMinutes - 30) {
        return `Available Today (${startFormatted})`;
      }
    } else if (offset === 1) {
      return `Tomorrow at ${startFormatted}`;
    } else {
      return `${DAY_NAMES_SHORT[dayIndex]} at ${startFormatted}`;
    }
  }

  // Fallback
  return `${formatAvailableDaysList(rawDays)} (${startFormatted})`;
}
