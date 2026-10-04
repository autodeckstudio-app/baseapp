import { Modal as RNModal, View, TouchableWithoutFeedback } from "react-native";
import { colors } from "../tokens/colors.js";
import { spacing } from "../tokens/spacing.js";
import { radius } from "../tokens/radius.js";
import { elevation } from "../tokens/elevation.js";

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/** Centered confirmation/dialog surface. For taller content, use BottomSheet instead. */
export function Modal({ visible, onClose, children }: ModalProps) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
          <TouchableWithoutFeedback>
            <View
              style={{
                backgroundColor: colors.surfaceElevated,
                borderRadius: radius.xl,
                padding: spacing.xl,
                width: "100%",
                maxWidth: 420,
                ...elevation.modal,
              }}
            >
              {children}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </RNModal>
  );
}
