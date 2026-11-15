// Static image assets bundled by Metro (see src/lib/imagery.ts).
declare module "*.jpg" {
  const value: number;
  export default value;
}
declare module "*.png" {
  const value: number;
  export default value;
}

declare module "*.webp" {
  import type {ImageSourcePropType} from "react-native";
  const value: ImageSourcePropType;
  export default value;
}
