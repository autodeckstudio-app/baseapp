'use client';

import { Card, Field, ThemedText } from '../../../ui/primitives';

/** Premium, simple settings shell — display only, not wired to a live endpoint in this pass. */
export default function SettingsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 480 }}>
      <ThemedText level="display">Settings</ThemedText>
      <Card>
        <ThemedText level="heading" style={{ marginBottom: 16 }}>
          Studio
        </ThemedText>
        <Field label="Studio name" defaultValue="AutoDeck Ahmedabad" disabled />
        <Field label="Operating hours" defaultValue="09:00 – 19:00" disabled />
        <ThemedText level="caption" color="secondary">
          Not editable in this pass.
        </ThemedText>
      </Card>
    </div>
  );
}
