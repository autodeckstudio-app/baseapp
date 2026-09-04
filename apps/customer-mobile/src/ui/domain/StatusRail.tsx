import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { motionScale, spacingScale } from '@autodeck/design-tokens';
import { Badge, ThemedText } from '../primitives';
import { useThemeColors } from '../theme';
import { useReducedMotion } from '../motion';
import type { MockBookingStatus } from '../../mocks/bookings.mock';

/**
 * Renders against the real 6-state `BookingStatus` machine from
 * `packages/domain/src/types.ts` (mirrored, not invented, in
 * `mocks/bookings.mock.ts`) — never AutoModz's more granular lifecycle.
 * `cancelled` is a terminal off-ramp reachable from `booked`/`in_progress`,
 * not a step in the linear sequence, so it renders as a standalone badge.
 *
 * Kept horizontal (not the vertical example in the brief) — doc-11's
 * approved design-system direction is explicit that StatusRail is
 * "horizontal on mobile ... vertical on admin web," and this is the
 * mobile customer app. Visual weight comes from connected step dots and
 * an animated fill line rather than a plain top progress bar.
 */
const SEQUENCE: MockBookingStatus[] = ['booked', 'in_progress', 'approval_required', 'completed', 'sealed'];

const STEP_LABEL: Record<MockBookingStatus, string> = {
  booked: 'Booked',
  in_progress: 'In progress',
  approval_required: 'Approval',
  completed: 'Completed',
  sealed: 'Sealed',
  cancelled: 'Cancelled',
};

export function StatusRail({ status }: { status: MockBookingStatus }) {
  const colors = useThemeColors();
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  const currentIndex = SEQUENCE.indexOf(status);
  const targetFraction = currentIndex === -1 ? 0 : currentIndex / (SEQUENCE.length - 1);

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(targetFraction);
      return;
    }
    Animated.timing(progress, {
      toValue: targetFraction,
      duration: motionScale.slow,
      useNativeDriver: false,
    }).start();
  }, [targetFraction, reducedMotion, progress]);

  if (status === 'cancelled') {
    return <Badge label={STEP_LABEL.cancelled} tone="danger" />;
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {SEQUENCE.map((step, index) => (
          <View key={step} style={{ flex: index === SEQUENCE.length - 1 ? 0 : 1, flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: index <= currentIndex ? colors.accent : colors.border,
              }}
            />
            {index < SEQUENCE.length - 1 && (
              <View style={{ flex: 1, height: 2, backgroundColor: colors.border, overflow: 'hidden', marginHorizontal: 2 }}>
                <Animated.View
                  style={{
                    height: 2,
                    backgroundColor: colors.accent,
                    width: progress.interpolate({
                      inputRange: [index / (SEQUENCE.length - 1), (index + 1) / (SEQUENCE.length - 1)],
                      outputRange: ['0%', '100%'],
                      extrapolate: 'clamp',
                    }),
                  }}
                />
              </View>
            )}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: spacingScale.sm }}>
        {SEQUENCE.map((step, index) => (
          <View key={step} style={{ flex: 1, alignItems: index === 0 ? 'flex-start' : index === SEQUENCE.length - 1 ? 'flex-end' : 'center' }}>
            <ThemedText
              level="caption"
              color={index <= currentIndex ? 'primary' : 'secondary'}
              style={{ fontWeight: index === currentIndex ? '600' : '400' }}
            >
              {STEP_LABEL[step]}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}
