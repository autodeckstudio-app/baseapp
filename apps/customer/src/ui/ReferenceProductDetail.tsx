import {Image,Linking,View} from 'react-native';
import {ServicePageHeader} from './ServicePageHeader';
import {ServicePhoto} from './ServicePhoto';
import {hasCataloguePhoto} from '../lib/catalogue-assets';
import {serviceTypeImage} from '../lib/service-type-images';
import {ServiceScope} from './ServiceScope';
import {ServicePrice} from './ServicePrice';
import {Button,Kicker,Pane,Row,Screen,T} from './kit';
import type{BrandEnquiry}from'../lib/brand-enquiries';
/** Same product-page construction as published services. Reference ranges remain quote-only, not bookable stock. */
export function ReferenceProductDetail({item,quoteReady,onAllServices,onRequest}:{item:BrandEnquiry;quoteReady:boolean;onAllServices:()=>void;onRequest:()=>void}){
 const product={id:'enquiry:'+item.key,name:item.name,brand:item.brand,category:item.group==='ppf'?'ppf' as const:'ceramic' as const,description:item.note};
 return <Screen header={<ServicePageHeader context={item.surface==='colour-ppf'?'Modifications & Wraps · Colour PPF':item.group==='ppf'?'Paint Protection · PPF':'Paint Protection · Ceramic'} title={item.name} crumbs={[{title:'All services',onPress:onAllServices}]}/> }>
  <Pane pad="none">{hasCataloguePhoto(product)?<ServicePhoto service={product} aspect={16/9} radius={26}/>:<View style={{aspectRatio:16/9,borderRadius:24,overflow:'hidden'}}><Image source={serviceTypeImage('paint',product.category==='ppf'?'PPF':'Ceramic')} resizeMode="cover" style={{width:'100%',height:'100%'}}/></View>}</Pane>
  {!hasCataloguePhoto(product)?<T role="caption" tone="tertiary">Service illustration, not this brand's product or studio work.</T>:null}
  <ServiceScope placement="description" showContactAndTip={false} service={product} onAsk={onRequest}/>
  <View style={{gap:12}}><Kicker>Scope to confirm</Kicker><Pane pad="gap">
   <Row title="Product" detail={item.level==='brand'?`${item.brand} · Exact product confirmed by the studio`:item.name}/>
   <Row title="Work and coverage" detail="Confirmed for your car before booking"/>
   <Row title="Service time" detail="Confirmed with your quote"/>
   <Row title="Availability" detail="Confirmed by the studio; this range is not a stock guarantee" last/>
  </Pane></View>
  <Kicker>Price for your car</Kicker><ServicePrice category={product.category} priceOnRequest needsCarType={false} hasCar={false} carSizeKnown={false} loading={false} error={null} breakdown={null} onRetry={()=>{}} onGarage={()=>{}}/>
  <Button label={quoteReady?(item.level==='brand'?'Request this brand':'Request this range'):'Ask for a quote'} onPress={onRequest}/>
  {item.source?<Pane pad="gap"><Row title="Product information" detail="Manufacturer's website" onPress={()=>void Linking.openURL(item.source!)} last/></Pane>:null}
  <T role="caption" tone="tertiary">Product availability, work, price and service time are confirmed in your quote. No booking is made by viewing this range.</T>
 </Screen>;
}
