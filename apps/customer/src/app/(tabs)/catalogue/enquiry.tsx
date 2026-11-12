import {detailHomeBack} from "../../../lib/home-service-navigation";
import {useLocalSearchParams,useRouter} from 'expo-router';
import {SERVICE_QUOTE_JOURNEY_READY} from '../../../lib/service-quote';
import {BRAND_ENQUIRIES} from '../../../lib/brand-enquiries';
import {Notice,Screen} from '../../../ui/kit';
import {ReferenceProductDetail} from '../../../ui/ReferenceProductDetail';
export default function BrandEnquiryScreen(){
 const params=useLocalSearchParams<{id?:string;returnTo?:string;homeEntry?:string;catalogueHome?:string;catalogueFamily?:string;catalogueBrand?:string;catalogueWork?:string}>();const {id}=params;const homeBack=detailHomeBack(params);const router=useRouter();const item=BRAND_ENQUIRIES.find(x=>x.key===id);
 if(!item)return <Screen appBar="Product enquiry"><Notice title="Range not found" body="Open Services to choose a current range."/></Screen>;
 return <ReferenceProductDetail onBack={homeBack?()=>router.replace(homeBack as never):undefined} item={item} quoteReady={SERVICE_QUOTE_JOURNEY_READY} onAllServices={()=>router.navigate('/(tabs)/catalogue')} onRequest={()=>SERVICE_QUOTE_JOURNEY_READY?router.push({pathname:'/(tabs)/quote-request',params:{referenceKey:item.key}}):router.push({pathname:'/(tabs)/help',params:{service:[item.brand,item.name].filter(Boolean).join(' ')}})}/>;
}
