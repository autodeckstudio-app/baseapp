import { Stack } from 'expo-router';

/** Lets Bookings push into Booking Status within its own tab, per Expo Router's tab+stack nesting pattern. */
export default function BookingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
