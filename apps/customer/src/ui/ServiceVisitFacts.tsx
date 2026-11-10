import type{ReactNode}from'react';
import {View}from'react-native';
import{NavIcon}from'./NavIcon';import{useExperienceTheme}from'@autodeck/ui/native';
import{Kicker,Pane,Row,T}from'./kit';
/** Catalogue facts and the actual next route, without inferred promises or price.
 *  Quote and inspection next-steps are stated once, by the Price section below. */
export function ServiceVisitFacts({duration,warranty,brand,quote,inspection,nextAction}:{duration:string;nextAction?:ReactNode;warranty?:string|null;brand?:string|null;quote:boolean;inspection:boolean}){
 const{colors}=useExperienceTheme();const icon=(name:"bookings"|"ceramic"|"services")=><NavIcon name={name} color={colors.textSecondary} size={20} cut="#18181C"/>;
 return <View style={{gap:12}}><Kicker>At a glance</Kicker><Pane pad="gap"><Row title="Estimated service time" detail={duration} trailing={nextAction} last={!brand&&!warranty}/>{brand?.trim()?<Row title="Product brand" detail={brand} trailing={icon("services")} last={!warranty}/>:null}{warranty?.trim()?<Row title="Listed warranty" detail={warranty} trailing={icon("ceramic")} last/>:null}</Pane><T role="caption" tone="secondary">{quote||inspection?"Service timing is an estimate; confirm the ready time with the studio.":"Choose your car and time, then review the total and estimated service time."}</T></View>;
}
