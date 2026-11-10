/** Supabase embeds can be returned as a single row, an array, or null. */
export type Related<T> = T | T[] | null;

export function firstRelated<T>(value: Related<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value as T | null;
}
