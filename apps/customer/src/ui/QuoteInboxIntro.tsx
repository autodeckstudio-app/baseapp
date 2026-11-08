import {View} from "react-native";
import {useExperienceTheme} from "@autodeck/ui/native";
import {NavIcon} from "./NavIcon";
import {Pane,T} from "./kit";
export function QuoteInboxIntro(){const{colors}=useExperienceTheme();return <Pane pad="inset"><View style={{flexDirection:"row",gap:12,alignItems:"center"}}><NavIcon name="chat" size={24} color={colors.textPrimary} cut="#18181C"/><View style={{flex:1,gap:5}}><T role="heading">Custom quotes</T><T role="caption" tone="secondary">Review the studio's work and price before approving.</T></View></View></Pane>}
