export function estimateOneRepMax(weightKg: number | null, reps: number | null): number | null {
  if (weightKg === null || reps === null || !Number.isFinite(weightKg) || !Number.isFinite(reps)) {
    return null;
  }
  if (weightKg <= 0 || reps <= 0) {
    return null;
  }
  if (reps === 1) {
    return weightKg;
  }
  return weightKg * (1 + reps / 30);
}
