// Live-harness imagery stub: Metro turns asset require()s into numeric module ids on
// device; vite cannot parse those binary requires, so the harness serves the same
// export surface with inert sources. Screen structure and document flow are unaffected.
import type { ImageSourcePropType } from "react-native";
const IMG = 1 as unknown as ImageSourcePropType;
export const detailingImage = IMG;
export const serviceImagery: Record<string, ImageSourcePropType> = new Proxy({}, { get: () => IMG });
export const vehicleImagery: Record<string, ImageSourcePropType> = new Proxy({}, { get: () => IMG });
export const sceneImagery: Record<string, ImageSourcePropType> = new Proxy({}, { get: () => IMG });
export function pooledPhoto(_topic: string, _variant: number): ImageSourcePropType | undefined { return IMG; }
export function primeVisuals(_list: unknown[]): void {}
export type ServiceVisual = { photo: ImageSourcePropType; bottle?: { src: ImageSourcePropType; tint: string } };
export function serviceVisual(_s: unknown, _variant = 0): ServiceVisual { return { photo: IMG }; }
export function brandHero(_name: string): ImageSourcePropType | null { return null; }
export function hasGaragePhoto(_name: string): boolean { return false; }
