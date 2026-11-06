import {View}from'react-native';
import {Kicker,Pane,Row,T}from'./kit';
/** Catalogue facts and the actual next route, without inferred promises or price. */
export function ServiceVisitFacts({duration,warranty,brand,quote,inspection}:{duration:string;warranty?:string|null;brand?:string|null;quote:boolean;inspection:boolean}){
 return <View style={{gap:12}}><Kicker>At a glance</Kicker><Pane pad="gap"><Row title="Service time" detail={`${duration}. This is an estimate; check the ready time when booking.`} last={!brand&&!warranty}/>{brand?.trim()?<Row title="Product brand" detail={brand} last={!warranty}/>:null}{warranty?.trim()?<Row title="Listed warranty" detail={warranty} last/>:null}</Pane><T role="caption" tone="secondary">{inspection?'Inspect first, then review the proposed work before approving a quote.':quote?'Request a quote for your car. Review the proposed work and price before approving it.':'Choose your car and an available time, then review the total before confirming.'}</T></View>;
}
