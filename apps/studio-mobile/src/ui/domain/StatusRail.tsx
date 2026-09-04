import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import type { BookingStatus } from '@autodeck/domain';
import { motionScale, spacingScale } from '@autodeck/design-tokens';
import { Badge, ThemedText } from '../primitives';
import { useThemeColors } from '../theme';
import { useReducedMotion } from '../motion';

/**
 * Renders against the REAL `BookingStatus` type from `@autodeck/domain` —
 * never an invented lifecycle. `cancelled` is a terminal off-ramp, shown
 * as a standalone badge rather than a rail position, matching
 * customer-mobile's identical StatusRail exactly (same sequence, same
 * rule) so the visual language is consistent across apps.
 */
const SEQUENCE: BookingStatus[] = ['booked', 'in_progress', 'approval_required', 'completed', 'sealed'];

/** One source of truth for status-colour mapping — consistent everywhere a status renders as a badge, per the approved rule. */
const COMPACT_TONE: Record<BookingStatus, 'neutral' | 'accent' | 'warning' | 'success' | 'danger'> = {
  booked: 'neutral',
  in_progress: 'accent',
  approval_required: 'warning',
  completed: 'success',
  sealed: 'success',
  cancelled: 'danger',
};

const STEP_LABEL: Record<BookingStatus, string> = {
  booked: 'Booked',
  in_progress: 'In progress',
  approval_required: 'Approval',
  completed: 'Completed',
  sealed: 'Sealed',
  cancelled: 'Cancelled',
};

export function StatusRail({ status, compact = false }: { status: BookingStatus; compact?: boolean }) {
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
    Animated.timing(progress, { toValue: targetFraction, duration: motionScale.slow, useNativeDriver: false }).start();
  }, [targetFraction, reducedMotion, progress]);

  if (status === 'cancelled') {
    return <Badge label={STEP_LABEL.cancelled} tone="danger" />;
  }

  if (compact) {
    return <Badge label={STEP_LABEL[status]} tone={COMPACT_TONE[status]} />;
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
