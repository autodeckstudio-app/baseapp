import { View } from 'react-native';
import { router } from 'expo-router';
import { radiusScale, spacingScale } from '@autodeck/design-tokens';
import { Button, Card, ThemedText } from '../primitives';
import { useThemeColors } from '../theme';
import { formatPaiseAsRupees } from '../../mocks/pricing.mirror';
import type { MockPackageDefinition } from '../../mocks/packages.mock';
import type { MockOwnedPackage } from '../../mocks/ownedPackages.mock';

/**
 * Two distinct presentations behind one component (kept as variants of the
 * same domain component rather than two separate ones, per "don't create
 * unnecessary abstractions"):
 *
 * - `packageDefinition` — public, pre-purchase browse card (a TYPE, no
 *   usage yet). No tier/renewal language anywhere.
 * - `ownedPackage` — the "Care Balance" wallet/pass treatment for a
 *   customer's purchased instance: purchased/used/remaining + a usage
 *   meter + "Top up", never "Renew". Visually and structurally distinct
 *   from a membership pricing card by design.
 */
export function PackageCard(
  props: { packageDefinition: MockPackageDefinition; ownedPackage?: never } | { ownedPackage: MockOwnedPackage; packageDefinition?: never }
) {
  if (props.ownedPackage) {
    return <OwnedPackageCard ownedPackage={props.ownedPackage} />;
  }
  return <BrowsePackageCard packageDefinition={props.packageDefinition} />;
}

function BrowsePackageCard({ packageDefinition }: { packageDefinition: MockPackageDefinition }) {
  const validity = `${packageDefinition.validityDuration.value} ${packageDefinition.validityDuration.unit}${
    packageDefinition.validityDuration.value > 1 ? 's' : ''
  }`;

  return (
    <Card>
      <ThemedText level="subheading">{packageDefinition.name}</ThemedText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacingScale.sm, marginTop: spacingScale.xs }}>
        <ThemedText level="body" tabularFigures>
          {formatPaiseAsRupees(packageDefinition.price)}
        </ThemedText>
        <ThemedText level="caption" color="secondary" tabularFigures>
          {packageDefinition.quantity}x · valid {validity}
        </ThemedText>
      </View>
    </Card>
  );
}

function OwnedPackageCard({ ownedPackage }: { ownedPackage: MockOwnedPackage }) {
  const colors = useThemeColors();
  const fraction = ownedPackage.remainingQty / ownedPackage.totalQty;

  return (
    <Card elevation="raised">
      <ThemedText level="caption" color="secondary" style={{ letterSpacing: 1 }}>
        CARE BALANCE
      </ThemedText>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacingScale.xs, marginTop: spacingScale.xs }}>
        <ThemedText level="display" tabularFigures>
          {ownedPackage.remainingQty}
        </ThemedText>
        <ThemedText level="body" color="secondary">
          services remaining
        </ThemedText>
      </View>

      <View
        style={{
          height: 6,
          borderRadius: radiusScale.full,
          backgroundColor: colors.border,
          overflow: 'hidden',
          marginTop: spacingScale.md,
        }}
      >
        <View style={{ height: 6, width: `${fraction * 100}%`, backgroundColor: colors.accent }} />
      </View>

      <ThemedText level="caption" color="secondary" tabularFigures style={{ marginTop: spacingScale.sm }}>
        {ownedPackage.totalQty} purchased · {ownedPackage.usedQty} used · {ownedPackage.remainingQty} remaining
      </ThemedText>
      <ThemedText level="caption" color="secondary" style={{ marginTop: spacingScale.xs }}>
        Valid until {ownedPackage.validUntil}
      </ThemedText>

      <View style={{ marginTop: spacingScale.md, alignSelf: 'flex-start' }}>
        <Button variant="secondary" onPress={() => router.push('/(tabs)/explore')}>
          Top up
        </Button>
      </View>
    </Card>
  );
}
