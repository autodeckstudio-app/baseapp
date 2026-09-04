import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import { motionScale } from '@autodeck/design-tokens';

export { motionScale };

/**
 * Tracks the OS-level "reduce motion" accessibility preference. Any
 * animation in the app must check this and skip straight to the end state
 * rather than interpolate, per the approved motion rule ("respect
 * reduced-motion preferences").
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) {
        setReduced(value);
      }
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

/**
 * A single, centrally-defined entrance treatment (fade + slight rise) for
 * hero content, cards, and images — per the approved motion requirement
 * ("hero entrance, image reveal, card entrance"). One component, reused
 * everywhere something needs to enter, rather than a bespoke animation per
 * screen. Skips straight to the resting state when reduced motion is on.
 */
export function FadeInView({
  children,
  delay = 0,
  duration = motionScale.slow,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
}) {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}
