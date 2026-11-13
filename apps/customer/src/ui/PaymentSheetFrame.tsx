import type { ReactNode } from 'react';
import { Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { useExperienceTheme } from '@autodeck/ui/native';
import { layout } from '@autodeck/ui/theme';
import { metrics } from '../lib/metrics';
/** Geometry only. Explicit panel and inner wrapper keep mobile scroll content inset. */
export function PaymentSheetFrame({children}:{children:ReactNode}) {
 const {width}=useWindowDimensions(),{name,colors}=useExperienceTheme();
 const gutter=width<360?layout.screenInsetCompact:layout.screenInset;
 return <View testID="payment-sheet-panel" style={{alignSelf:'center',width:width-gutter*2,maxWidth:layout.readingMeasure-gutter*2,maxHeight:'90%',marginBottom:gutter,borderRadius:metrics.cardRadius,borderWidth:1,borderColor:colors.borderSubtle,overflow:'hidden',backgroundColor:name==='light'?'#FAF9F6':colors.surfaceElevated}}><ScrollView accessibilityViewIsModal style={{flexGrow:0}} contentContainerStyle={{flexGrow:1}}><View testID="payment-sheet-content" style={{paddingHorizontal:metrics.cardPad,paddingTop:24,paddingBottom:(Platform.OS==='web'?'calc(20px + env(safe-area-inset-bottom))':32) as unknown as number,gap:16}}>{children}</View></ScrollView></View>;
}
