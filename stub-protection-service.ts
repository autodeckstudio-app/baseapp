// Re-export the REAL protection-service logic; override only the IO seams.
export * from "../src/lib/protection-service";
import type { Protection } from "@autodeck/core";
export const listenToVehicleProtections = (_id: string, _t: string, _c: string, onData: (l: Protection[]) => void) => {
  onData(((globalThis as Record<string, unknown>).__pixelProtections as Protection[]) ?? []);
  return () => {};
};
export const createMyProtection = async () => ({ id: "new" });
export const updateMyProtection = async () => {};
