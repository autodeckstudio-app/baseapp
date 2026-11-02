// Dev-only: loads the Garage sample module only when __DEV__ is true. In a production export the
// `__DEV__ ? require(...) : null` branch is eliminated before bundling and metro.config.js blocks
// the sample file, so fake cars cannot ship. See scripts/prod-bundle-guard.mjs.
// Outside Metro (vitest node environment) the relative require cannot resolve: fall back to no mock.
import type { devGarage as garageDevSample, devGarageDetail as garageDevDetailSample } from "./garage-dev-sample";

type SampleModule = { devGarage: typeof garageDevSample; devGarageDetail: typeof garageDevDetailSample };
let sample: SampleModule | null = null;
try {
  sample = __DEV__ ? (require("./garage-dev-sample") as SampleModule) : null;
} catch {
  sample = null;
}

export const devGarage: typeof garageDevSample | null = sample ? sample.devGarage : null;
export const devGarageDetail: typeof garageDevDetailSample | null = sample ? sample.devGarageDetail : null;
