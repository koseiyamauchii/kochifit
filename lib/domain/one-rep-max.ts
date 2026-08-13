export function estimateOneRepMax(weightKg: number, reps: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) {
    return null;
  }
  if (weightKg <= 0 || reps <= 0) {
    return null;
  }
  if (reps === 1) {
    return weightKg;
  }
  return Math.round(weightKg * (1 + reps / 30));
}
