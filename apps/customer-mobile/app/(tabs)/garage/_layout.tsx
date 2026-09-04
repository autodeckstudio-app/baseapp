import { Stack } from 'expo-router';

/** Lets Garage push into Vehicle Detail within its own tab, per Expo Router's tab+stack nesting pattern. */
export default function GarageLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
