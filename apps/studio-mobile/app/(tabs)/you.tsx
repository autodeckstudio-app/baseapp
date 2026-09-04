import { View } from 'react-native';
import { spacingScale } from '@autodeck/design-tokens';
import { useAuth } from '../../src/auth/AuthProvider';
import { Badge, Button, Card, Screen, ThemedText } from '../../src/ui/primitives';

const ROLE_LABEL = { staff: 'Staff', studio_manager: 'Studio Manager', owner_admin: 'Owner/Admin' } as const;

/**
 * Role-aware access note reflects the ACTUAL, preserved RBAC (per the
 * Studio+Admin audit) — not the cleaner mapping suggested elsewhere.
 * Studio Manager and Owner/Admin both retain their existing tested
 * admin-web access; nothing here changes authorization, it only surfaces
 * what already exists so a manager isn't left wondering where their
 * catalogue/staff-management tools are.
 */
export default function YouScreen() {
  const { session, signOut } = useAuth();

  if (session.status !== 'authenticated') {
    return null;
  }

  return (
    <Screen>
      <View style={{ padding: spacingScale.lg, gap: spacingScale.lg }}>
        <ThemedText level="display">You</ThemedText>

        <Card elevation="raised">
          <ThemedText level="caption" color="secondary">
            Signed in as
          </ThemedText>
          <ThemedText level="subheading" style={{ marginBottom: spacingScale.sm }}>
            {session.uid}
          </ThemedText>
          <Badge label={ROLE_LABEL[session.role]} tone="accent" />
        </Card>

        {(session.role === 'studio_manager' || session.role === 'owner_admin') && (
          <Card>
            <ThemedText level="body" color="secondary">
              Your {ROLE_LABEL[session.role]} account also has access to AutoDeck Admin — service catalogue,
              packages, inventory, and staff management live there, not in Studio.
            </ThemedText>
          </Card>
        )}

        <Button variant="secondary" onPress={() => void signOut()}>
          Sign out
        </Button>
      </View>
    </Screen>
  );
}
