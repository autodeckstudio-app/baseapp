import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { heroColors, spacingScale } from '@autodeck/design-tokens';
import { useAuth } from '../../src/auth/AuthProvider';
import { Button, Card, Divider, EmptyState, Screen, ThemedText } from '../../src/ui/primitives';
import { PhotoPlaceholder } from '../../src/ui/domain/PhotoPlaceholder';
import { StatusRail } from '../../src/ui/domain/StatusRail';
import { ServiceCard } from '../../src/ui/domain/ServiceCard';
import { PackageCard } from '../../src/ui/domain/PackageCard';
import { FadeInView } from '../../src/ui/motion';
import { MOCK_BOOKINGS } from '../../src/mocks/bookings.mock';
import { MOCK_VEHICLES } from '../../src/mocks/vehicles.mock';
import { MOCK_SERVICES } from '../../src/mocks/services.mock';
import { MOCK_OWNED_PACKAGES } from '../../src/mocks/ownedPackages.mock';

const WORK_STEPS = [
  { step: '01', title: 'Explore', body: 'Browse detailing and protection services built around your car.' },
  { step: '02', title: 'Book', body: 'Choose a time. We confirm the bay and the price up front.' },
  { step: '03', title: 'Relax', body: 'Track every stage live, from intake to a sealed, documented finish.' },
];

const PROTECTION_TYPES = ['Ceramic Coating', 'Paint Protection Film', 'Insurance'];

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { session } = useAuth();
  const isAuthenticated = session.status === 'authenticated';

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: spacingScale.xxl }}>
        {!isAuthenticated ? (
          <LoggedOutHome />
        ) : (
          <LoggedInHome vehicle={MOCK_VEHICLES[0]} bookings={MOCK_BOOKINGS} />
        )}
      </ScrollView>
    </Screen>
  );
}

function LoggedOutHome() {
  return (
    <>
      <FadeInView>
        <PhotoPlaceholder height={460} radius={0} scrim>
          <View style={{ padding: spacingScale.lg, paddingBottom: spacingScale.xl, gap: spacingScale.sm }}>
            <ThemedText level="caption" color="inherit" style={{ color: heroColors.textSecondary, letterSpacing: 2 }}>
              AUTODECK
            </ThemedText>
            <ThemedText level="display" color="inherit" style={{ color: heroColors.textPrimary }}>
              Your car, in expert hands.
            </ThemedText>
            <ThemedText level="body" color="inherit" style={{ color: heroColors.textSecondary, marginBottom: spacingScale.sm }}>
              A premium detailing studio built on precision, full visibility, and craftsmanship you can see.
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: spacingScale.sm }}>
              <View style={{ flex: 1 }}>
                <Button onPress={() => router.push('/(tabs)/explore')}>Book a Service</Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  variant="ghost"
                  onPress={() => router.push('/(tabs)/explore')}
                  style={{ borderWidth: 1, borderColor: heroColors.textSecondary }}
                >
                  <ThemedText level="body" color="inherit" style={{ color: heroColors.textPrimary, fontWeight: '600' }}>
                    Explore Services
                  </ThemedText>
                </Button>
              </View>
            </View>
          </View>
        </PhotoPlaceholder>
      </FadeInView>

      <View style={{ padding: spacingScale.lg, gap: spacingScale.md }}>
        <ThemedText level="heading">Featured Services</ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacingScale.md }}>
          {MOCK_SERVICES.slice(0, 3).map((service) => (
            <View key={service.serviceId} style={{ width: 220 }}>
              <ServiceCard service={service} />
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={{ padding: spacingScale.lg, gap: spacingScale.lg }}>
        <ThemedText level="heading">How AutoDeck Works</ThemedText>
        {WORK_STEPS.map((item) => (
          <View key={item.step} style={{ flexDirection: 'row', gap: spacingScale.md }}>
            <ThemedText level="heading" color="secondary" tabularFigures style={{ width: 32 }}>
              {item.step}
            </ThemedText>
            <View style={{ flex: 1, gap: spacingScale.xs }}>
              <ThemedText level="subheading">{item.title}</ThemedText>
              <ThemedText level="body" color="secondary">
                {item.body}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>

      <View style={{ padding: spacingScale.lg, gap: spacingScale.sm }}>
        <ThemedText level="heading">Vehicle Care &amp; Protection</ThemedText>
        <ThemedText level="body" color="secondary" style={{ marginBottom: spacingScale.xs }}>
          Every protection applied at AutoDeck is recorded against your vehicle — coverage, dates, and status,
          always visible.
        </ThemedText>
        <View style={{ gap: spacingScale.xs }}>
          {PROTECTION_TYPES.map((type, index) => (
            <View key={type}>
              {index > 0 && <Divider style={{ marginBottom: spacingScale.xs }} />}
              <ThemedText level="body">{type}</ThemedText>
            </View>
          ))}
        </View>
      </View>

      <View style={{ paddingHorizontal: spacingScale.lg }}>
        <PhotoPlaceholder height={220} scrim>
          <View style={{ padding: spacingScale.lg, alignItems: 'flex-start', gap: spacingScale.sm }}>
            <ThemedText level="heading" color="inherit" style={{ color: heroColors.textPrimary }}>
              Ready when you are.
            </ThemedText>
            <Button onPress={() => router.push('/(tabs)/explore')}>Book a Service</Button>
          </View>
        </PhotoPlaceholder>
      </View>
    </>
  );
}

function LoggedInHome({
  vehicle,
  bookings,
}: {
  vehicle: (typeof MOCK_VEHICLES)[number] | undefined;
  bookings: typeof MOCK_BOOKINGS;
}) {
  const activeBooking = bookings.find((booking) => booking.status !== 'sealed' && booking.status !== 'cancelled');
  const recentBookings = bookings.filter((booking) => booking !== activeBooking).slice(0, 2);

  return (
    <View style={{ padding: spacingScale.lg, gap: spacingScale.xl }}>
      <FadeInView>
        <View style={{ gap: spacingScale.md }}>
          <View>
            <ThemedText level="caption" color="secondary">
              {greeting()}
            </ThemedText>
            <ThemedText level="display">{vehicle ? `${vehicle.make} ${vehicle.model}` : 'Welcome back'}</ThemedText>
            {vehicle && (
              <ThemedText level="body" color="secondary" tabularFigures>
                {vehicle.plate}
              </ThemedText>
            )}
          </View>

          {activeBooking ? (
            <Card elevation="raised">
              <ThemedText level="subheading" style={{ marginBottom: spacingScale.md }}>
                {activeBooking.serviceName}
              </ThemedText>
              <StatusRail status={activeBooking.status} />
              <View style={{ marginTop: spacingScale.md }}>
                <Button onPress={() => router.push(`/(tabs)/bookings/${activeBooking.bookingId}`)}>
                  Track Booking
                </Button>
              </View>
            </Card>
          ) : (
            <Card>
              <EmptyState
                message="No active service right now."
                action={<Button onPress={() => router.push('/(tabs)/explore')}>Book a Service</Button>}
              />
            </Card>
          )}
        </View>
      </FadeInView>

      <View style={{ gap: spacingScale.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <ThemedText level="heading">Your garage</ThemedText>
          <Button variant="ghost" onPress={() => router.push('/(tabs)/garage')}>
            View all
          </Button>
        </View>
        {vehicle ? (
          <PhotoPlaceholder height={160}>
            <View style={{ padding: spacingScale.md }}>
              <ThemedText level="subheading" color="inherit" style={{ color: heroColors.textPrimary }}>
                {vehicle.make} {vehicle.model}
              </ThemedText>
              <ThemedText level="caption" color="inherit" tabularFigures style={{ color: heroColors.textSecondary }}>
                {vehicle.plate}
              </ThemedText>
            </View>
          </PhotoPlaceholder>
        ) : (
          <EmptyState message="No vehicles added yet." />
        )}
      </View>

      <View style={{ gap: spacingScale.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <ThemedText level="heading">Care balance</ThemedText>
          <Button variant="ghost" onPress={() => router.push('/(tabs)/explore')}>
            View all
          </Button>
        </View>
        {MOCK_OWNED_PACKAGES[0] && <PackageCard ownedPackage={MOCK_OWNED_PACKAGES[0]} />}
      </View>

      {recentBookings.length > 0 && (
        <View style={{ gap: spacingScale.md }}>
          <ThemedText level="heading">Recent bookings</ThemedText>
          {recentBookings.map((booking) => (
            <Card key={booking.bookingId}>
              <ThemedText level="subheading">{booking.serviceName}</ThemedText>
              <ThemedText level="caption" color="secondary" style={{ marginTop: spacingScale.xs }}>
                {booking.status.replace('_', ' ')}
              </ThemedText>
            </Card>
          ))}
        </View>
      )}
    </View>
  );
}
