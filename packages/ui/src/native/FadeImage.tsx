import { useRef, useState } from "react";
import { Animated, View, type ImageProps, type StyleProp, type ViewStyle } from "react-native";

type Props = Omit<ImageProps, "style"> & { style?: StyleProp<ViewStyle>; placeholder?: string };

/** Image that fades in once loaded over a soft tinted placeholder, so lists never pop or flash blank. */
export function FadeImage({ style, placeholder = "rgba(60,40,90,0.06)", onLoad, ...rest }: Props) {
  const op = useRef(new Animated.Value(0)).current;
  const [done, setDone] = useState(false);
  return (
    <View style={[{ backgroundColor: done ? "transparent" : placeholder, overflow: "hidden" }, style]}>
      <Animated.Image
        {...rest}
        onLoad={(e) => {
          onLoad?.(e);
          Animated.timing(op, { toValue: 1, duration: 220, useNativeDriver: true }).start(() => setDone(true));
        }}
        style={{ width: "100%", height: "100%", opacity: op }}
      />
    </View>
  );
}
