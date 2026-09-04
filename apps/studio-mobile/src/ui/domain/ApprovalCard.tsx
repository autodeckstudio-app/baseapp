import { useState } from 'react';
import { View } from 'react-native';
import { spacingScale } from '@autodeck/design-tokens';
import { Button, Card, ThemedText } from '../primitives';
import { formatPaiseAsRupees } from '../../mocks/format';
import type { MockApprovalRequest } from '../../mocks/jobs.mock';

/**
 * Staff-side resolve UI. Per `apps/backend/src/approvals/approvals.types.ts`'s
 * own doc comment, the customer's decision is "recorded by staff" — staff
 * gets the customer's decision by phone/in person and records it here,
 * corresponding to the real `PATCH approvals/:id/resolve` endpoint
 * (`@Roles('staff')`). No live call is wired in this UI-only pass.
 * Approve/Decline are equal-weight, no decorative red — same rule as
 * customer-mobile's identical card, for a consistent design language.
 */
export function ApprovalCard({ request }: { request: MockApprovalRequest }) {
  const [decision, setDecision] = useState(request.decision);

  if (decision !== 'pending') {
    return (
      <Card elevation="raised">
        <ThemedText level="subheading">
          Recorded as {decision} — not yet wired to the live resolve endpoint in this pass.
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
        {request.description}
      </ThemedText>
      <ThemedText level="caption" color="secondary">
        Additional cost
      </ThemedText>
      <ThemedText level="subheading" tabularFigures style={{ marginBottom: spacingScale.md }}>
        +{formatPaiseAsRupees(request.additionalAmountPaise)}
      </ThemedText>
      <ThemedText level="caption" color="secondary" style={{ marginBottom: spacingScale.sm }}>
        Record the customer's decision:
      </ThemedText>
      <View style={{ flexDirection: 'row', gap: spacingScale.sm }}>
        <View style={{ flex: 1 }}>
          <Button onPress={() => setDecision('declined')}>Declined</Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button onPress={() => setDecision('approved')}>Approved</Button>
        </View>
      </View>
    </Card>
  );
}
