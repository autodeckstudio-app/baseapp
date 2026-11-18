import {ServiceIdentityMedia} from './ServiceIdentityMedia';
import {Linking} from 'react-native';
import {ServicePageHeader} from './ServicePageHeader';
import {referenceManufacturerFacts} from '../lib/reference-manufacturer-facts';
import {ProductFactRows} from './ProductFactRows';
import {Button,Row,Screen,T} from './kit';
import type{BrandEnquiry}from'../lib/brand-enquiries';
/** Original product-page layout; only verified manufacturer data, no inferred studio claims. */
export function ReferenceProductDetail({item,quoteReady:_quoteReady,onAllServices,onRequest,onBack}:{item:BrandEnquiry;quoteReady:boolean;onAllServices:()=>void;onRequest:()=>void;onBack?:(()=>void)|undefined}){
 const facts=referenceManufacturerFacts(item);
 const product={id:'enquiry:'+item.key,name:item.name,brand:item.brand,category:item.group==='ppf'?'ppf' as const:'ceramic' as const};
 return <Screen onBack={onBack} top={<ServicePageHeader context={item.surface==='colour-ppf'?'Modifications & Wraps · Colour PPF':item.group==='ppf'?'Paint Protection · PPF':'Paint Protection · Ceramic'} title={item.name} crumbs={[{title:'All services',onPress:onAllServices}]}/> }>
  <ServiceIdentityMedia service={{...product,brand:product.brand??null,customerMenu:{home:item.surface==='colour-ppf'?'modifications':'paint',family:item.surface==='colour-ppf'?'Colour PPF':item.group==='ppf'?'PPF':'Ceramic'}}}/>
  {facts?<ProductFactRows facts={facts}/>:item.source?<Row title="Product details" detail="Manufacturer's website" onPress={()=>void Linking.openURL(item.source!)} last/>:null}
  <Button label="Discuss your requirements" kind="quiet" onPress={onRequest}/>
 </Screen>;
}
