// Dev-only: loads the Garage sample module only when __DEV__ is true. In a production export the branch is removed
// and metro.config.js blocks the sample file, so fake cars cannot ship. See scripts/prod-bundle-guard.mjs.
import type { devGarage as garageDevSample } from "./garage-dev-sample";

export const devGarage: typeof garageDevSample | null = __DEV__
  ? (require("./garage-dev-sample") as { devGarage: typeof garageDevSample }).devGarage
  : null;
