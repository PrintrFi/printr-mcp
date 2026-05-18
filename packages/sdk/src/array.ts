/** Generic readonly-array utilities. */

/**
 * Drop `null` and `undefined` values from an array while preserving order.
 * The return type is narrowed to exclude the nullish branch.
 */
export const compact = <T>(arr: readonly (T | undefined | null)[]): readonly T[] =>
  arr.filter((x): x is T => x != null);

/** Remove duplicates from an array while preserving first-seen order. */
export const dedupe = <T>(arr: readonly T[]): readonly T[] => [...new Set(arr)];
