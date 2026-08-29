import type { CardioUnitSettings } from "@/lib/workouts/types";

export const defaultCardioUnits: CardioUnitSettings = {
  distance: "km",
  duration: "min",
  speed: "kmh",
  calories: "kcal",
};

export function getCardioUnitLabels(units: CardioUnitSettings) {
  return {
    distance: units.distance === "m" ? "m" : "km",
    duration: units.duration === "sec" ? "秒" : "分",
    speed: units.speed === "ms" ? "m/s" : "km/h",
    calories: units.calories === "kj" ? "kJ" : "kcal",
  };
}

export function cardioInputToStorage(
  metric: keyof CardioUnitSettings,
  value: number | null,
  units: CardioUnitSettings,
) {
  if (value === null) {
    return null;
  }
  switch (metric) {
    case "distance":
      return units.distance === "m" ? value / 1000 : value;
    case "duration":
      return units.duration === "sec" ? Math.round(value) : Math.round(value * 60);
    case "speed":
      return units.speed === "ms" ? value * 3.6 : value;
    case "calories":
      return units.calories === "kj" ? value / 4.184 : value;
  }
}

export function cardioStorageToDisplay(
  metric: keyof CardioUnitSettings,
  value: number | null,
  units: CardioUnitSettings,
) {
  if (value === null) {
    return null;
  }
  switch (metric) {
    case "distance":
      return units.distance === "m" ? value * 1000 : value;
    case "duration":
      return units.duration === "min" ? value / 60 : value;
    case "speed":
      return units.speed === "ms" ? value / 3.6 : value;
    case "calories":
      return units.calories === "kj" ? value * 4.184 : value;
  }
}
