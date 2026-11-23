import { createRequire } from "node:module";
import { vi } from "vitest";
const require = createRequire(import.meta.url);
// Metro resolves bundled media; Node render tests use a stable inert resource.
for (const ext of [".jpg", ".png", ".jpeg"]) require.extensions[ext] = (module: any, filename: string) => { module.exports = { uri: filename }; };
// Images keep their props and event callbacks without starting a browser download.
vi.mock("react-native", async () => {
 const actual = await vi.importActual<any>("react-native-web");
 const React = await import("react");
 return {...actual, Image: (props: any) => React.createElement("Image", props)};
});

// react-native-web image effects need this inert browser primitive in Node.
Object.defineProperty(globalThis, "window", {value: {Image: class {src="";onload: any;onerror: any;}}, configurable:true, writable:true});
