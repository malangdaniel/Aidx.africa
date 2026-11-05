/**
 * Helpers for "propose a profile change" requests.
 *
 * Providers (doctors / pharmacies) submit edits for admin review. Only the
 * fields that actually differ from the current live data are sent, so the admin
 * sees exactly what was edited and nothing else.
 */

const normalize = (v: unknown): unknown => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') return v.trim() === '' ? null : v.trim();
  if (Array.isArray(v)) return v.length === 0 ? null : v;
  return v;
};

/** True when two values are equivalent (empty string / null / undefined / [] all count as "empty"). */
export function isSameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

/** Returns only the keys of `edited` whose value differs from `live`. */
export function diffObject<T extends Record<string, any>>(live: T | null | undefined, edited: T): Partial<T> {
  const out: Partial<T> = {};
  (Object.keys(edited) as (keyof T)[]).forEach((k) => {
    if (!isSameValue(live?.[k], edited[k])) out[k] = edited[k];
  });
  return out;
}

export const hasKeys = (o: object | null | undefined): boolean => !!o && Object.keys(o).length > 0;

/** True when `key` is present in a (possibly partial) change object. */
export const has = (o: object | null | undefined, key: string): boolean =>
  !!o && Object.prototype.hasOwnProperty.call(o, key);
