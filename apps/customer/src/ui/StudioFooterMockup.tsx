import React, { useEffect, useState } from 'react';
import { AppState, Image, View, Text, Platform } from 'react-native';
import { useExperienceTheme } from '@autodeck/ui/native';
import { textStyle } from './kit';
import { studioPhotoPeriod } from '../lib/studio-photo-time';
import dayOriginal from '../../assets/studio/studio-front-day-grey.png';
import dayWeb from '../../assets/studio/studio-front-day-grey.webp';
import eveningOriginal from '../../assets/studio/studio-front-evening-grey.png';
import eveningWeb from '../../assets/studio/studio-front-evening-grey.webp';

export function StudioFooterMockup() {
  const { colors } = useExperienceTheme();
  const [period, setPeriod] = useState(() => studioPhotoPeriod());
  useEffect(() => {
    const refresh = () => setPeriod(studioPhotoPeriod());
    const interval = setInterval(refresh, 30_000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { clearInterval(interval); subscription?.remove(); };
  }, []);
  const source = period === 'day' ? (Platform.OS === 'web' ? dayWeb : dayOriginal) : (Platform.OS === 'web' ? eveningWeb : eveningOriginal);
  return <View testID='home-studio-mockup' style={{ width: '100%', marginTop: 20, gap: 8 }}><View style={{ width: '100%', aspectRatio: 1155 / 438, borderRadius: 24, overflow: 'hidden' }}><Image source={source} accessibilityLabel={`AutoDeck studio frontage, ${period === 'day' ? 'day' : 'evening'}, promotional reconstruction`} resizeMode='contain' style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} /></View><Text style={{ ...textStyle('caption'), color: colors.textSecondary, fontSize: 10, lineHeight: 15 }}>Studio promotional image</Text></View>;
}
