import{FactHighlights}from"../../../ui/FactHighlights";
import{ServicePageHeader}from"../../../ui/ServicePageHeader";
import {SERVICE_QUOTE_JOURNEY_READY} from '../../../lib/service-quote';
import {hasCataloguePhoto} from "../../../lib/catalogue-assets";
import {ServicePhoto} from '../../../ui/ServicePhoto';
import {serviceVisual} from '../../../lib/imagery';
import {Linking,View} from 'react-native';
import {space} from '@autodeck/ui/theme';
import {useLocalSearchParams,useRouter} from 'expo-router';
import {BRAND_ENQUIRIES} from '../../../lib/brand-enquiries';
import {Button,Kicker,Notice,Pane,Row,Screen,T} from '../../../ui/kit';
export default function BrandEnquiryScreen(){
 const {id}=useLocalSearchParams<{id?:string}>();const router=useRouter();const item=BRAND_ENQUIRIES.find(x=>x.key===id);
 if(!item)return <Screen appBar="Product enquiry"><Notice title="Range not found" body="Open Services to choose a current range."/></Screen>;
 const product={id:'enquiry:'+item.key,name:item.name,brand:item.brand,category:item.group==='ppf'?'ppf':'ceramic'};
 return <Screen appBar={item.brand ?? 'Paint protection'}><ServicePageHeader context={item.surface==='colour-ppf'?'Colour PPF':item.group==='ppf'?'Paint protection':'Coating'} title={item.name} crumbs={[{title:"All services",onPress:()=>router.navigate("/(tabs)/catalogue")}]}/>{(hasCataloguePhoto(product)||serviceVisual(product).bottle)?<ServicePhoto service={product} height={190} radius={18}/>:null}<FactHighlights facts={[{value:"Quote first",label:"Price confirmed for your car"},{value:"You approve",label:"Before work is booked"}]}/><View style={{gap:space.breath}}><Kicker>About this range</Kicker><T tone="secondary">{item.note}</T><Kicker>Scope to confirm</Kicker><Pane pad="gap"><T>{item.level==='brand'?'Ask the studio to confirm product, coverage and price before booking.':'Ask the studio to confirm product, work and price for your car.'}</T>{item.source?<Row title="Product information" detail="Manufacturer's website" onPress={()=>void Linking.openURL(item.source!)} last/>:null}</Pane></View><Button label={SERVICE_QUOTE_JOURNEY_READY?(item.level==='brand'?"Request this brand":"Request this range"):"Ask for a quote"} onPress={()=>SERVICE_QUOTE_JOURNEY_READY?router.push({pathname:'/(tabs)/quote-request',params:{referenceKey:item.key}}):router.push({pathname:'/(tabs)/help',params:{service:[item.brand,item.name].filter(Boolean).join(" ")}})}/></Screen>;
}
