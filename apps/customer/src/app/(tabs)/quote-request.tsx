import { Pressable, Text, View } from 'react-native';
import { useExperienceTheme } from '@autodeck/ui/native';
import { serviceActionSurface } from '../../lib/service-action-surface';
import {useRouter}from'expo-router';
import{Screen,T,PageHeader,Pane}from'../../ui/kit';
export default function StudioInspection(){const router=useRouter();const {name,colors}=useExperienceTheme();
  const action = (label: string, onPress: () => void, primary = false) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={{ flex: 1, minWidth: 0, minHeight: 44, justifyContent: "center" }}>
      {({ pressed }) => (
        <View pointerEvents="none" style={{
          ...serviceActionSurface(name, false, pressed),
          minHeight: 36, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
          borderColor: primary ? colors.borderStrong : colors.borderSubtle,
          backgroundColor: primary ? colors.surface : "transparent",
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: 11, lineHeight: 15, fontWeight: primary ? "600" : "500", color: colors.textPrimary, textAlign: "center" }}>{label}</Text>
        </View>
      )}
    </Pressable>
  );

return <Screen appBar="Studio inspection"><PageHeader title="Studio inspection" sub="Bring your car for inspection"/><Pane pad="inset"><T>For work without a listed price, visit the studio. Agree the work and final price before service starts.</T><T>Existing bookings and work approvals stay in Bookings. Nothing has been deleted.</T></Pane><View style={{flexDirection:'row',gap:10,alignItems:'stretch'}}>{action('Studio details',()=>router.navigate('/(tabs)/help'),true)}{action('Browse services',()=>router.navigate('/(tabs)/catalogue'))}</View></Screen>}
