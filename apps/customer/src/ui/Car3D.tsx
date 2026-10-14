// Native fallback: the 3D view is web-only for now, so phones keep the drawn car.
import type { ReactElement } from "react";
import type { BodyShape, ZoneKey } from "../lib/car-models";

export type Car3DProps = {
  shape: BodyShape; colour: string; night: boolean; selected: ZoneKey;
  zones: Array<{ key: ZoneKey; label: string; ok: boolean }>; anchors: Record<ZoneKey, [number, number]>;
  onSelect: (k: ZoneKey) => void; width: number; height: number;
};
export const car3dSupported = false;
export function Car3D(_p: Car3DProps): ReactElement | null { return null; }
