// Weight is the recorded load for one side when left/right repetitions exist.
export function getTotalReps(reps: number | null, left: number | null, right: number | null) {
  return left !== null || right !== null ? (left ?? 0) + (right ?? 0) : reps;
}

export function trainingVolume(weightKg: number | null, reps: number | null, left: number | null, right: number | null) {
  const totalReps = getTotalReps(reps, left, right);
  return weightKg === null || totalReps === null ? null : weightKg * totalReps;
}
