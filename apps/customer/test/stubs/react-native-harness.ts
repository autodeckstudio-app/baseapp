// react-native-web minus the DOM-bound pieces, for the node harness. Same approach
// as the mocked-render suite: TextInput is a passthrough host element so the real
// screen code (props, onChangeText, value) runs unchanged without a DOM.
export * from "react-native-web";
import { createElement } from "react";
export const TextInput = (props: Record<string, unknown>) => createElement("TextInput", props);
