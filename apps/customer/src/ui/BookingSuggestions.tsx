import { View } from "react-native";
import type { Service, Vehicle } from "@autodeck/core";
import { raised } from "../lib/raised";
import { useExperienceTheme } from "@autodeck/ui/native";
import { ServicePhoto } from "./ServicePhoto";
import { Button, SectionTitle, T } from "./kit";
export type BookingSuggestion = { service: Service; reason: string };
/** One vehicle identity owns every suggestion and its booking destination. */
export function BookingSuggestions({ vehicle, suggestions, onChooseTime }: { vehicle: Pick<Vehicle,"id"|"make"|"model">; suggestions: BookingSuggestion[]; onChooseTime: (serviceId:string,vehicleId:string)=>void }) {
  const { name } = useExperienceTheme();
  if (!suggestions.length) return null;
  return <View style={{gap:12}}>
    <SectionTitle>For your {vehicle.make} {vehicle.model}</SectionTitle>
    {suggestions.map(({service,reason})=><View key={service.id} style={{...raised(name).card,borderRadius:20,padding:14,gap:14}}>
      <View style={{flexDirection:"row",gap:12,alignItems:"center"}}>
        <View style={{width:64,height:64,borderRadius:12,overflow:"hidden"}}><ServicePhoto service={service} height={64}/></View>
        <View style={{flex:1,minWidth:0,gap:4}}><T role="bodyStrong">{service.name.replace(/^Kovalent\s+/i,"")}</T><T role="caption" tone="secondary">{reason}</T></View>
      </View>
      <Button kind="quiet" label="Choose time" onPress={()=>onChooseTime(service.id,vehicle.id)}/>
    </View>)}
  </View>;
}
