// react-native-web ignores Alert.alert, so confirmations never ran and errors were silent.
// On web, route it to the browser dialogs: no buttons -> alert, buttons -> confirm then run the main button.
import { Alert, Platform, type AlertButton } from "react-native";


if (Platform.OS === "web") {
  const w = globalThis as { alert?: (m: string) => void; confirm?: (m: string) => boolean };
  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = [title, message].filter(Boolean).join("\n\n");
    const action = (buttons ?? []).find((b) => b.style !== "cancel" && b.onPress);
    if (!buttons || buttons.length === 0 || !action) {
      w.alert?.(text);
      buttons?.find((b) => b.onPress)?.onPress?.();
      return;
    }
    const hasCancel = buttons.some((b) => b.style === "cancel");
    if (!hasCancel || w.confirm?.(text)) action.onPress?.();
  };
}
export {};
