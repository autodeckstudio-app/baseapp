import {View} from 'react-native';
import {space} from '@autodeck/ui/theme';
import {Row,T} from './kit';
const FACTS={
 delete:[['Removed','This car and its cover photo.'],['Kept','Documents, history and bills.'],['Also kept','Inspection photos.'],['Final','Deletion cannot be undone.']],
 protection:[['Add','Existing PPF or ceramic details.'],['Source','Added by you, not verified by AutoDeck.'],['Warranty','Years alone do not set an expiry date.']],
 unfinished:[['Save','Not finished yet.'],['Next','Resume, open your car, or start over.'],['Editing','Locked until you choose.']],
}as const;
/** Short labelled facts. Never clamp or hide a disclosure to fit. */
export function GarageDisclosure({kind}:{kind:keyof typeof FACTS}){return <View testID={`garage-disclosure-${kind}`} style={{gap:space.hair}}>{kind==='delete'?<T role="bodyStrong">Delete this car forever?</T>:null}{FACTS[kind].map(([title,detail],i)=><Row key={title} title={title} detail={detail} last={i===FACTS[kind].length-1}/>)}</View>}
