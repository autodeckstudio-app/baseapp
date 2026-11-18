import {Image,Text,View} from 'react-native';
import {Icon,useExperienceTheme} from '@autodeck/ui/native';
import type {Service} from '@autodeck/core';
import {spotlightProductPhoto} from '../lib/catalogue-assets';
import {BRAND_LOGOS} from '../lib/brand-logos';
import {serviceTypeImage} from '../lib/service-type-images';
/** Shared media geometry. Exact products retain their photos; missing paint-product photos use their brand, never application art. */
export function ServiceIdentityMedia({service}:{service:Pick<Service,'id'|'name'|'brand'|'category'> & {customerMenu?:Pick<NonNullable<Service['customerMenu']>,'home'|'family'>}}){
 const {colors}=useExperienceTheme();
 const paint=service.customerMenu?.home==='paint'||['ceramic','ppf'].includes(service.category);
 const product=spotlightProductPhoto(service),logo=service.brand?BRAND_LOGOS[service.brand]:undefined;
 const art=!paint&&service.customerMenu?serviceTypeImage(service.customerMenu.home,service.customerMenu.family):undefined;
 return <View style={{gap:7}}><View testID="service-identity-media" style={{aspectRatio:1.7,borderRadius:24,overflow:'hidden',minWidth:0,backgroundColor:colors.accentHaze,alignItems:'center',justifyContent:'center'}}>
  {product?<Image accessibilityLabel={`${service.name} product`} source={product} resizeMode="contain" style={{width:'78%',height:'84%'}}/>:art?<Image accessibilityLabel={`${service.customerMenu?.family} service illustration`} source={art} resizeMode="cover" style={{width:'100%',height:'100%'}}/>:logo?<Image accessibilityLabel={`${service.brand} brand logo, product photo unavailable`} source={logo.src} resizeMode="contain" style={{width:'58%',height:'45%'}}/>:<View style={{alignItems:'center',gap:10}}><Icon mono name="shield" size={42} color={colors.textSecondary}/>{service.brand&&service.brand!=='Standard'?<Text style={{color:colors.textPrimary,fontSize:18,fontWeight:'600'}}>{service.brand}</Text>:null}</View>}
 </View>{!product?<Text style={{fontSize:10,lineHeight:16,color:colors.textSecondary}}>{art?'Illustrative service image, not studio work.':logo?'Brand logo shown. Exact product photo unavailable.':'Service symbol shown. Product image not supplied.'}</Text>:null}</View>;
}
