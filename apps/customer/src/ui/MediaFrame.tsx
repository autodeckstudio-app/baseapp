import {View} from 'react-native';
import type {ReactNode} from 'react';
/** One clipping owner for media. No glass border behind a differently rounded image. */
export function MediaFrame({children}:{children:ReactNode}){
 return <View testID="media-frame" style={{borderRadius:24,overflow:'hidden',minWidth:0}}>{children}</View>;
}
