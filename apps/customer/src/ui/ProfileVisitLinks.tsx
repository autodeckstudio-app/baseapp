import { View } from "react-native";
import { Kicker, Pane } from "./kit";
import { ListRow } from "./ListRow";
/** Custom quotes live here. Booking history stays in the Bookings tab. */
export function ProfileVisitLinks({onQuotes}:{onQuotes:()=>void}){
 return <View style={{gap:10}}><Kicker>Your visit</Kicker><Pane pad="inset"><ListRow icon="chat" title="Your quotes" detail="Custom work and prices from the studio" onPress={onQuotes} last/></Pane></View>;
}
