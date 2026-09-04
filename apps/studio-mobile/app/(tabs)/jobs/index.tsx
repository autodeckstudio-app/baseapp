import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { spacingScale } from '@autodeck/design-tokens';
import { EmptyState, Screen, ThemedText, Touchable } from '../../../src/ui/primitives';
import { JobCard } from '../../../src/ui/domain/JobCard';
import { FadeInView } from '../../../src/ui/motion';
import { MOCK_JOBS } from '../../../src/mocks/jobs.mock';

export default function JobsScreen() {
  return (
    <Screen>
      <View style={{ padding: spacingScale.lg, flex: 1, gap: spacingScale.lg }}>
        <ThemedText level="display">Jobs</ThemedText>
        <FlatList
          data={MOCK_JOBS}
          keyExtractor={(item) => item.visitId}
          contentContainerStyle={{ gap: spacingScale.md }}
          ListEmptyComponent={<EmptyState message="No jobs today." />}
          renderItem={({ item, index }) => (
            <FadeInView delay={index * 50}>
              <Touchable onPress={() => router.push(`/(tabs)/jobs/${item.visitId}`)}>
                <JobCard job={item} />
              </Touchable>
            </FadeInView>
          )}
        />
      </View>
    </Screen>
  );
}
