import { Image, Text, View } from 'react-native';
import { useExperienceTheme } from '@autodeck/ui/native';
import wordmark from '../../assets/brand/wordmark-dark.png';
import { textStyle } from './kit';

/** Temporary branded illustration, never a claim about the real studio frontage. */
export function StudioFooterMockup() {
  const { colors } = useExperienceTheme();
  return <View testID="home-studio-mockup" style={{ gap: 8, marginTop: 20 }}>
    <View accessible accessibilityRole="image" accessibilityLabel="AutoDeck studio mockup illustration. Not an actual studio photograph." style={{ aspectRatio: 2.3, borderRadius: 24, overflow: 'hidden', backgroundColor: '#171D23', paddingHorizontal: 22, paddingTop: 17, justifyContent: 'flex-end' }}>
      <View style={{ position: 'absolute', width: 170, height: 170, borderRadius: 85, right: -60, top: -100, backgroundColor: '#EC863818' }} />
      <View style={{ borderWidth: 1, borderColor: '#737A813F', borderBottomWidth: 0, borderTopLeftRadius: 7, borderTopRightRadius: 7, paddingHorizontal: 12, paddingTop: 10, gap: 10 }}>
        <View style={{ alignItems: 'center', paddingBottom: 7, borderBottomWidth: 1, borderColor: '#EC863882' }}><Image source={wordmark} resizeMode="contain" style={{ width: 128, maxWidth: '70%', height: 18 }} /></View>
        <View style={{ flexDirection: 'row', gap: 8, height: 45 }}>{[0,1,2].map(i => <View key={i} style={{ flex: 1, borderWidth: 1, borderBottomWidth: 0, borderColor: '#8C979E40', backgroundColor: '#080D1166', justifyContent: 'flex-start' }}><View style={{ height: 2, backgroundColor: '#EC86385C', marginHorizontal: 5, marginTop: 5 }} /><View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: '#8C979E20' }} /></View>)}</View>
      </View>
      <View style={{ height: 18, marginHorizontal: -22, borderTopWidth: 1, borderColor: '#90999F40', backgroundColor: '#20272C' }} />
    </View>
    <Text style={{ ...textStyle('caption'), color: colors.textSecondary, fontSize: 10, lineHeight: 15 }}>Studio mockup · Not an actual photo</Text>
  </View>;
}
