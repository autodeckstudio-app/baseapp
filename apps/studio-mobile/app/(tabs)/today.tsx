import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { spacingScale } from '@autodeck/design-tokens';
import { Badge, Card, Screen, ThemedText, Touchable } from '../../src/ui/primitives';
import { FadeInView } from '../../src/ui/motion';
import { JobCard } from '../../src/ui/domain/JobCard';
import { MOCK_JOBS } from '../../src/mocks/jobs.mock';

const STATUS_ORDER = ['booked', 'in_progress', 'approval_required', 'completed', 'sealed'] as const;

/**
 * "Digital workshop command center" — not a generic analytics dashboard.
 * Leads with the operational summary (counts by status, scannable in one
 * glance) and the jobs that actually need attention now, not vanity
 * metrics. Fixture data throughout — Studio reads Firestore directly in
 * production (see the Studio+Admin audit); no live query is wired here.
 */
export default function TodayScreen() {
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const countsByStatus = STATUS_ORDER.reduce<Record<string, number>>((acc, status) => {
    acc[status] = MOCK_JOBS.filter((job) => job.status === status).length;
    return acc;
  }, {});
  const needsAttention = MOCK_JOBS.filter((job) => job.status === 'approval_required');
  const upNext = MOCK_JOBS.filter((job) => job.status === 'booked' || job.status === 'in_progress');

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacingScale.lg, gap: spacingScale.xl }}>
        <FadeInView>
          <View>
            <ThemedText level="caption" color="secondary">
              {today}
            </ThemedText>
            <ThemedText level="display">Today's Workshop</ThemedText>
          </View>
        </FadeInView>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacingScale.sm }}>
          {STATUS_ORDER.map((status) => (
            <Card key={status} style={{ flexGrow: 1, minWidth: 100 }}>
              <ThemedText level="display" tabularFigures>
                {countsByStatus[status]}
              </ThemedText>
              <ThemedText level="caption" color="secondary">
                {status.replace('_', ' ')}
              </ThemedText>
            </Card>
          ))}
        </View>

        {needsAttention.length > 0 && (
          <View style={{ gap: spacingScale.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacingScale.sm }}>
              <ThemedText level="heading">Needs attention</ThemedText>
              <Badge label={String(needsAttention.length)} tone="warning" />
            </View>
            {needsAttention.map((job) => (
              <Touchable key={job.visitId} onPress={() => router.push(`/(tabs)/jobs/${job.visitId}`)}>
                <JobCard job={job} />
              </Touchable>
            ))}
          </View>
        )}

        <View style={{ gap: spacingScale.md }}>
          <ThemedText level="heading">Up next</ThemedText>
          {upNext.length === 0 ? (
            <ThemedText level="body" color="secondary">
              Nothing scheduled right now.
            </ThemedText>
          ) : (
            upNext.map((job) => (
              <Touchable key={job.visitId} onPress={() => router.push(`/(tabs)/jobs/${job.visitId}`)}>
                <JobCard job={job} />
              </Touchable>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
