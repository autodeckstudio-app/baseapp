import { Modal as RNModal, View, TouchableWithoutFeedback, SafeAreaView } from "react-native";
import { colors } from "../tokens/colors.js";
import { spacing } from "../tokens/spacing.js";
import { radius } from "../tokens/radius.js";
import { elevation } from "../tokens/elevation.js";

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/** Slide-up sheet for actions/forms too tall for a centered Modal
 * (e.g. slot pickers, filters). Uses the platform's native slide
 * transition — no gesture/animation library needed. */
export function BottomSheet({ visible, onClose, children }: BottomSheetProps) {
  return (
    <RNModal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" }}>
          <TouchableWithoutFeedback>
            <SafeAreaView
              style={{
                backgroundColor: colors.surfaceElevated,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                paddingHorizontal: spacing.xl,
                paddingTop: spacing.md,
                paddingBottom: spacing.xl,
                ...elevation.sheet,
              }}
            >
              <View
                style={{
                  alignSelf: "center",
                  width: 36,
                  height: 4,
                  borderRadius: radius.full,
                  backgroundColor: colors.border,
                  marginBottom: spacing.md,
                }}
              />
              {children as any}
            </SafeAreaView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
}
