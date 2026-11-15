import {View} from 'react-native';
export type MapPoint={lat:number;lng:number};
export type PickupLocationProps={value:MapPoint|null;disabled?:boolean;onSelect:(point:MapPoint)=>void};
/** Native fallback; the supported web app resolves PickupLocation.web. */
export function PickupLocation(_props:PickupLocationProps){return<View/>}
