import { useState } from 'react';
import { View } from 'react-native';
import { spacingScale } from '@autodeck/design-tokens';
import { Button, Card, ThemedText } from '../primitives';
import { formatPaiseAsRupees } from '../../mocks/pricing.mirror';
import type { MockApprovalRequest } from '../../mocks/bookings.mock';

/**
 * Urgent-but-not-panic-inducing decision UI, per the approved requirement:
 * amber framing (never decorative red), Approve/Reject as equal-weight
 * primary actions. No backend exists for this action — selecting either
 * option shows a local, clearly-mocked acknowledgement rather than
 * pretending to submit anywhere.
 */
export function ApprovalCard({ request }: { request: MockApprovalRequest }) {
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);

  if (decision) {
    return (
      <Card elevation="raised">
        <ThemedText level="subheading">
          {decision === 'approved' ? 'Approved' : 'Rejected'} — this is a mock decision (no backend exists yet).
        </ThemedText>
      </Card>
    );
  }

  return (
    <Card elevation="raised">
      <ThemedText level="caption" color="warning" style={{ letterSpacing: 1, marginBottom: spacingScale.xs }}>
        APPROVAL NEEDED
      </ThemedText>
      <ThemedText level="body" style={{ marginBottom: spacingScale.md }}>
        {request.reason}
      </ThemedText>
      <View style={{ flexDirection: 'row', gap: spacingScale.lg, marginBottom: spacingScale.md }}>
        <View>
          <ThemedText level="caption" color="secondary">
            Price impact
          </ThemedText>
          <ThemedText level="subheading" tabularFigures>
            +{formatPaiseAsRupees(request.priceDeltaPaise)}
          </ThemedText>
        </View>
        <View>
          <ThemedText level="caption" color="secondary">
            Time impact
          </ThemedText>
          <ThemedText level="subheading" tabularFigures>
            +{request.timeDeltaMinutes} min
          </ThemedText>
        </View>
      </View>
      {/*
        Both buttons use the same `primary` styling deliberately: the
        approved requirement is equal visual weight AND no decorative red
        UI, which rules out the usual green/red pairing. Identical styling,
        distinguished only by label, is the most literal way to satisfy
        both constraints at once without inventing a third Button variant
        for a single screen.
      */}
      <View style={{ flexDirection: 'row', gap: spacingScale.sm }}>
        <View style={{ flex: 1 }}>
          <Button onPress={() => setDecision('rejected')}>Reject</Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button onPress={() => setDecision('approved')}>Approve</Button>
        </View>
      </View>
    </Card>
  );
}
