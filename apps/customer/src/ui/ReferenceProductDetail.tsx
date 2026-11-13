import {MediaFrame} from "./MediaFrame";
import {Image,Linking,View} from 'react-native';
import {ServicePageHeader} from './ServicePageHeader';
import {ServicePhoto} from './ServicePhoto';
import {hasCataloguePhoto} from '../lib/catalogue-assets';
import {serviceTypeImage} from '../lib/service-type-images';
import {referenceManufacturerFacts} from '../lib/reference-manufacturer-facts';
import {ProductFactRows} from './ProductFactRows';
import {Button,Row,Screen,T} from './kit';
import type{BrandEnquiry}from'../lib/brand-enquiries';
/** Original product-page layout; only verified manufacturer data, no inferred studio claims. */
export function ReferenceProductDetail({item,quoteReady:_quoteReady,onAllServices,onRequest,onBack}:{item:BrandEnquiry;quoteReady:boolean;onAllServices:()=>void;onRequest:()=>void;onBack?:(()=>void)|undefined}){
 const facts=referenceManufacturerFacts(item);
 const product={id:'enquiry:'+item.key,name:item.name,brand:item.brand,category:item.group==='ppf'?'ppf' as const:'ceramic' as const};
 return <Screen onBack={onBack} header={<ServicePageHeader context={item.surface==='colour-ppf'?'Modifications & Wraps · Colour PPF':item.group==='ppf'?'Paint Protection · PPF':'Paint Protection · Ceramic'} title={item.name} crumbs={[{title:'All services',onPress:onAllServices}]}/> }>
  <MediaFrame>{hasCataloguePhoto(product)?<ServicePhoto service={product} aspect={16/9}/>:<View style={{aspectRatio:16/9,overflow:'hidden'}}><Image source={serviceTypeImage('paint',product.category==='ppf'?'PPF':'Ceramic')} resizeMode="cover" style={{width:'100%',height:'100%'}}/></View>}</MediaFrame>
  {!hasCataloguePhoto(product)?<T role="caption" tone="tertiary">Service illustration, not this brand's product or studio work.</T>:null}
  {facts?<ProductFactRows facts={facts}/>:item.source?<Row title="Product details" detail="Manufacturer's website" onPress={()=>void Linking.openURL(item.source!)} last/>:null}
  <Button label="Get quote" kind="quiet" onPress={onRequest}/>
 </Screen>;
}
