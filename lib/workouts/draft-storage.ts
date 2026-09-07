// A recoverable, device-local draft only. Confirmed records remain in PostgreSQL.
export interface DraftEnvelope<T> {
  version: 1;
  value: T;
  updatedAt: string;
  baseline: string | null;
}

export function workoutDraftKey(userId: string, date: string, workoutId?: string) {
  return `kochifit:draft:v1:${userId}:${date}:${workoutId ?? "new"}`;
}

export function readWorkoutDraft<T>(storage: Pick<Storage, "getItem">, key: string,
  validate: (value: unknown) => value is T): DraftEnvelope<T> | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (parsed?.version !== 1 || !validate(parsed.value) || typeof parsed.updatedAt !== "string" ||
    (parsed.baseline !== null && typeof parsed.baseline !== "string")) {
    throw new Error("Unsupported draft format");
  }
  return parsed;
}

export function writeWorkoutDraft<T>(storage: Pick<Storage, "setItem">, key: string, value: T, baseline: string | null = null) {
  const envelope: DraftEnvelope<T> = { version: 1, value, baseline, updatedAt: new Date().toISOString() };
  storage.setItem(key, JSON.stringify(envelope));
  return envelope;
}
