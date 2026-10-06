// Compatibility names map to the shared product geometry.
import { radius as shape } from "../theme/scale.js";
export const radius = { sm: shape.chip, md: shape.chip, lg: shape.card, xl: shape.pane, full: shape.pill } as const;
export type RadiusToken = keyof typeof radius;
