// Ground per theme: the root paints it once, every scene is transparent.
import { raised, type Mode } from "./raised";
export const groundFor = (mode: Mode) => raised(mode).ground;
export const groundImageFor = (mode: Mode) => raised(mode).groundImage;
export const GROUND_COLOR = "#0F1013";
