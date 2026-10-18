import type { ReactElement } from "react";
import type { ZoneKey } from "../lib/service-zones";

export type ZoneCarProps = {
  zones: Array<{ key: ZoneKey; label: string }>;
  selected: ZoneKey | null;
  onSelect: (k: ZoneKey) => void;
  night: boolean;
  width: number;
  height: number;
};
// The 3D car is web only. On phones' native builds the zone chips below it carry the whole choice.
export const zoneCarSupported = false;
export function ZoneCar(_p: ZoneCarProps): ReactElement | null { return null; }
