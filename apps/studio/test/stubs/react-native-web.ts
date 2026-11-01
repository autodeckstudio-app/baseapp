// Render-harness stand-in for react-native (-web). Everything is the real
// react-native-web EXCEPT TextInput: the web TextInput's effects require a
// DOM (document), and this harness runs in plain node. Typing is not under
// test here - the render tests assert copy and chip/press wiring - so a
// static element preserving value/placeholder for copy assertions suffices.
import { createElement } from "react";
export * from "react-native-web";
export const TextInput = (props: { value?: string; placeholder?: string }) =>
  createElement("span", { "data-testid": "TextInput" }, `${props?.placeholder ?? ""}${props?.value ? `:${props.value}` : ""}`);
