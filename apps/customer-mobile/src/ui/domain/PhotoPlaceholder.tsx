import type { ReactNode } from 'react';
import { View } from 'react-native';
import { heroColors, heroScrimStops, radiusScale } from '@autodeck/design-tokens';

/**
 * No approved studio/vehicle photography exists in this repository, and
 * fabricating stock imagery is not an option — per the approved UI
 * requirements, this must be a documented placeholder strategy, not
 * arbitrary images. This renders a fixed-dark abstract composition (a
 * dark panel + two soft, off-center highlight layers simulating light
 * across a curved glossy/ceramic surface) rather than a flat grey box —
 * evocative of automotive gloss without pretending to be a photograph.
 *
 * Deliberately uses `heroColors` (fixed dark), not `useThemeColors()` — a
 * photograph doesn't re-theme with the OS light/dark setting, and this is
 * standing in for one. Every card that would show real photography uses
 * this one component, so swapping in real images later is a one-file
 * change.
 */
export function PhotoPlaceholder({
  height = 140,
  radius = radiusScale.md,
  scrim = false,
  children,
}: {
  height?: number;
  radius?: number;
  /** Adds a bottom-up darkening scrim for text legibility (hero use). */
  scrim?: boolean;
  children?: ReactNode;
}) {
  return (
    <View
      style={{
        height,
        borderRadius: radius,
        borderCurve: 'continuous',
        backgroundColor: heroColors.base,
        overflow: 'hidden',
      }}
    >
      {/* Simulated reflective surface: two soft, overlapping highlight fields. */}
      <View
        style={{
          position: 'absolute',
          width: '70%',
          height: '140%',
          borderRadius: 9999,
          backgroundColor: heroColors.panelA,
          opacity: 0.9,
          top: '-30%',
          left: '-10%',
          transform: [{ rotate: '-8deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: '55%',
          height: '120%',
          borderRadius: 9999,
          backgroundColor: heroColors.panelB,
          opacity: 0.55,
          top: '-10%',
          right: '-15%',
          transform: [{ rotate: '12deg' }],
        }}
      />

      {scrim &&
        heroScrimStops.map((opacity, index) => (
          <View
            key={index}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: `${((index + 1) / heroScrimStops.length) * 100}%`,
              backgroundColor: heroColors.scrim,
              opacity: opacity / heroScrimStops.length,
            }}
          />
        ))}

      {children && (
        <View style={{ flex: 1, justifyContent: 'flex-end', padding: 0 }} pointerEvents="box-none">
          {children}
        </View>
      )}
    </View>
  );
}
