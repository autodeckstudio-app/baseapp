import { View } from 'react-native';
import { spacingScale } from '@autodeck/design-tokens';
import { Card, ThemedText } from '../primitives';
import { formatPaiseAsRupees } from '../../mocks/pricing.mirror';
import type { MockService } from '../../mocks/services.mock';
import { PhotoPlaceholder } from './PhotoPlaceholder';

/**
 * `compact` = Explore/Home list (roughly 60% image / 40% information, per
 * the approved photography-led ratio); `featured` = Service Detail hero
 * content. Warranty is shown as quiet caption text, not a Badge pill —
 * the previous pill treatment was flagged in the visual audit as
 * contributing to a "dense, decorated" feel Explore is meant to avoid.
 */
export function ServiceCard({ service, variant = 'compact' }: { service: MockService; variant?: 'compact' | 'featured' }) {
  return (
    <Card>
      <PhotoPlaceholder height={variant === 'featured' ? 260 : 160} />
      <View style={{ marginTop: spacingScale.md, gap: spacingScale.xs }}>
        <ThemedText level="subheading">{service.name}</ThemedText>
        {variant === 'featured' && (
          <ThemedText level="body" color="secondary" style={{ marginBottom: spacingScale.xs }}>
            {service.description}
          </ThemedText>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacingScale.sm }}>
          <ThemedText level="body" tabularFigures>
            {formatPaiseAsRupees(service.basePrice)}
          </ThemedText>
          <ThemedText level="caption" color="secondary" tabularFigures>
            {service.durationMinutes} min
          </ThemedText>
        </View>
        {service.warrantyLabel && (
          <ThemedText level="caption" color="secondary">
            {service.warrantyLabel}
          </ThemedText>
        )}
      </View>
    </Card>
  );
}
