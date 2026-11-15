import { Component, type ReactNode } from "react";
import { Platform, Pressable, Text, View } from "react-native";

type State = { failed: boolean };

/** Catches a render crash anywhere below it and shows a calm page with a way back, instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  componentDidCatch(error: unknown) { console.warn("screen crashed", error); }
  private retry = () => {
    this.setState({ failed: false });
  };
  private reload = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loc = (globalThis as any).location;
    if (Platform.OS === "web" && loc) loc.assign("/");
    else this.retry();
  };
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View accessibilityRole="alert" style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 }}>
        <Text style={{ fontSize: 20, fontWeight: "800", color: "#888" }}>Something went wrong</Text>
        <Text style={{ fontSize: 15, textAlign: "center", color: "#888", maxWidth: 320 }}>The page could not open. Your bookings and car details are safe. Try again, or start from Home.</Text>
        <Pressable accessibilityRole="button" onPress={this.retry} style={{ minHeight: 48, paddingHorizontal: 22, borderRadius: 24, backgroundColor: "#16181C", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#F4F2EF", fontWeight: "700", fontSize: 15 }}>Try again</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={this.reload} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#EC8638", fontWeight: "700", fontSize: 15 }}>Go to Home</Text>
        </Pressable>
      </View>
    );
  }
}
