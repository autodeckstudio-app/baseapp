import { View } from 'react-native';
import { useAuth } from '../../src/auth/AuthProvider';
import { Button, Card, EmptyState, Screen } from '../../src/ui/primitives';

/** Placeholder only — per Phase 3A scope, business screens (garage,
 * vehicle detail, booking, live visit tracking, mid-visit approvals,
 * packages, payment, history) are later phases. */
export default function CustomerHomeScreen() {
  const { signOut } = useAuth();
  return (
    <Screen>
      <View style={{ alignItems: 'flex-end', marginBottom: 16 }}>
        <Button variant="secondary" onPress={() => void signOut()}>
          Log out
        </Button>
      </View>
      <Card>
        <EmptyState message="AutoDeck foundation is set up. Business screens will be built in a later phase." />
      </Card>
    </Screen>
  );
}
