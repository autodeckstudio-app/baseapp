import { useCallback } from 'react';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { freshCarsEntry } from '../lib/cars-navigation';

/** Runs on focus, not just mount: hidden-tab screens survive a visit to Home. */
export function useCarsEntry(page: 'index' | '[id]' | 'sell') {
  const navigation = useNavigation();
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  useFocusEffect(useCallback(() => {
    const reset = freshCarsEntry(navigation.getState() as never, page, returnTo);
    if (reset) navigation.dispatch({ type: 'RESET', payload: reset } as never);
  }, [navigation, page, returnTo]));
  // A cold refresh still remembers the fixed Home origin. Never accept a free-form URL.
  return returnTo === "home" ? () => router.navigate("/(tabs)") : undefined;
}
