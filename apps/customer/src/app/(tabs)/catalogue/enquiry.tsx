import { SceneIntro } from "../../../ui/SceneIntro";
import {SERVICE_QUOTE_JOURNEY_READY} from '../../../lib/service-quote';
import {hasCataloguePhoto} from "../../../lib/catalogue-assets";
import {ServicePhoto} from '../../../ui/ServicePhoto';
import {serviceVisual} from '../../../lib/imagery';
import {Linking} from 'react-native';
import {useLocalSearchParams,useRouter} from 'expo-router';
import {BRAND_ENQUIRIES} from '../../../lib/brand-enquiries';
import {Button,Kicker,Notice,Pane,Row,Screen,T} from '../../../ui/kit';
export default function BrandEnquiryScreen(){
 const {id}=useLocalSearchParams<{id?:string}>();const router=useRouter();const item=BRAND_ENQUIRIES.find(x=>x.key===id);
 if(!item)return <Screen appBar="Product enquiry"><Notice title="Range not found" body="Open Services to choose a current range."/></Screen>;
 const product={id:'enquiry:'+item.key,name:item.name,brand:item.brand,category:item.group==='ppf'?'ppf':'ceramic'};
 return <Screen appBar={item.brand ?? 'Paint protection'}><SceneIntro compact eyebrow={item.surface==='colour-ppf'?'Colour PPF':item.group==='ppf'?'Paint protection':'Coating'} title={item.name}/>{(hasCataloguePhoto(product)||serviceVisual(product).bottle)?<ServicePhoto service={product} height={250} radius={18}/>:null}<Pane><T>{item.note}</T></Pane>{item.source?<Row title="Product information" detail="Manufacturer's website" onPress={()=>void Linking.openURL(item.source!)} last/>:null}<Kicker>Scope to confirm</Kicker><T>This range is for enquiry. The studio needs to confirm the exact product, work and quote for your car.</T><Button label={SERVICE_QUOTE_JOURNEY_READY?"Request this range":"Ask for a quote"} onPress={()=>SERVICE_QUOTE_JOURNEY_READY?router.push({pathname:'/(tabs)/quote-request',params:{referenceKey:item.key}}):router.push({pathname:'/(tabs)/help',params:{service:[item.brand,item.name].filter(Boolean).join(" ")}})}/></Screen>;
}
