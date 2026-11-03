import {Linking} from 'react-native';
import {useLocalSearchParams,useRouter} from 'expo-router';
import {BRAND_ENQUIRIES} from '../../../lib/brand-enquiries';
import {Button,Kicker,Notice,Pane,Row,Screen,T} from '../../../ui/kit';
export default function BrandEnquiryScreen(){
 const {id}=useLocalSearchParams<{id?:string}>();const router=useRouter();const item=BRAND_ENQUIRIES.find(x=>x.key===id);
 if(!item)return <Screen appBar="Product enquiry"><Notice title="Range not found" body="Open Services to choose a current range."/></Screen>;
 return <Screen appBar={item.brand ?? 'Paint protection'}><Kicker>{item.group==='ppf'?'Paint protection':'Coating'}</Kicker><T role="title">{item.name}</T><Pane><T>{item.note}</T></Pane>{item.source?<Row title="Product information" detail="Manufacturer's website" onPress={()=>void Linking.openURL(item.source!)} last/>:null}<Button label="Ask for a quote" onPress={()=>router.push({pathname:'/(tabs)/help',params:{service:[item.brand,item.name].filter(Boolean).join(" ")}})}/></Screen>;
}
