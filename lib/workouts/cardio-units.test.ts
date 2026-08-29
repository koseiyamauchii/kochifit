import { describe, expect, it } from "vitest";
import {
  cardioInputToStorage,
  cardioStorageToDisplay,
  defaultCardioUnits,
} from "@/lib/workouts/cardio-units";

describe("cardio unit conversion", () => {
  it("keeps the default units in the database base units", () => {
    expect(cardioInputToStorage("distance", 5, defaultCardioUnits)).toBe(5);
    expect(cardioInputToStorage("duration", 30, defaultCardioUnits)).toBe(1800);
    expect(cardioInputToStorage("speed", 10, defaultCardioUnits)).toBe(10);
    expect(cardioInputToStorage("calories", 250, defaultCardioUnits)).toBe(250);
  });

  it("converts alternate units to and from database base units", () => {
    const alternateUnits = {
      distance: "m",
      duration: "sec",
      speed: "ms",
      calories: "kj",
    } as const;

    expect(cardioInputToStorage("distance", 1500, alternateUnits)).toBe(1.5);
    expect(cardioInputToStorage("duration", 90, alternateUnits)).toBe(90);
    expect(cardioInputToStorage("speed", 3, alternateUnits)).toBeCloseTo(10.8);
    expect(cardioInputToStorage("calories", 418.4, alternateUnits)).toBeCloseTo(100);
    expect(cardioStorageToDisplay("distance", 1.5, alternateUnits)).toBe(1500);
    expect(cardioStorageToDisplay("duration", 90, alternateUnits)).toBe(90);
    expect(cardioStorageToDisplay("speed", 10.8, alternateUnits)).toBeCloseTo(3);
    expect(cardioStorageToDisplay("calories", 100, alternateUnits)).toBeCloseTo(418.4);
  });
});
