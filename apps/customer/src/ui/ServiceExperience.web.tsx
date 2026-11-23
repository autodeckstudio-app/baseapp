import React,{useMemo} from 'react';
import{presentationTitle,presentationScope}from'../lib/service-presentation';
import {View} from 'react-native';
import {useExperienceTheme} from '@autodeck/ui/native';
import {type Service} from '@autodeck/core';
import {isCartEligible,cartSelectionState,toggleCartService} from '../lib/service-cart';
import {serviceSelection} from '../lib/booking-selection';
import {servicePlacement} from '../lib/services-navigation';
import {ExperienceContext,type ServiceExperienceProps,type ExperienceRuntime} from './services-experience/runtime';
import {ExperienceView} from './services-experience/ExperienceView';
import type {MenuService} from './services-experience/model';
export type {ServiceExperienceProps} from './services-experience/runtime';
export function presentationService(service:Service):MenuService|null{
 const placement=servicePlacement(service);if(!placement||service.category==='pickup'||!service.active)return null;
 const display=service.id==='svc_51ac65707000d30261ac87ec17b2c853'?{name:presentationTitle(service),description:presentationScope(service).included.concat(presentationScope(service).limits).join('\n')}:{};
 return {...service,...display,brand:service.brand??undefined,description:display.description??service.description??'',vehicleCategoryPricing:service.vehicleCategoryPricing??[],customerMenu:{...service.customerMenu,home:placement.home,family:placement.family,priceMode:service.customerMenu?.priceMode??(service.priceOnRequest?'inspection':'fixed')},comparisonScope:placement.home==='paint'&&placement.family==='PPF'?(service.ppfWork??(service.coverageLevel==='full_body'?'full_body':'other')):undefined} as MenuService;
}
export default function ServiceExperience(props:ServiceExperienceProps){
 const {name,colors}=useExperienceTheme();
 const services=useMemo(()=>props.services.map(presentationService).filter((s):s is MenuService=>!!s),[props.services]);
 const originals=useMemo(()=>new Map(props.services.map(s=>[s.id,s])),[props.services]);
 const runtime:ExperienceRuntime={...props,services,original:props.services,theme:name==='light'?'light':'night',
  eligible:s=>{const original=originals.get(s.id);return !!original&&isCartEligible(original)},
  price:s=>{const original=originals.get(s.id);return original?props.priceLabel(original)??'Checking price…':'Unavailable'},
  onOpen:id=>{const original=originals.get(id);if(original)props.onOpen(original)},
  cart:{ids:props.selection.ids,state:cartSelectionState(props.services,props.selection.ids),
   toggle:s=>{const original=originals.get(s.id);return toggleCartService(original??({...s,active:false} as unknown as Service),props.services,{ids:serviceSelection.read(props.selection.scope),toggle:id=>serviceSelection.toggle(props.selection.scope,id)})},
   remove:id=>{if(serviceSelection.read(props.selection.scope).includes(id))serviceSelection.toggle(props.selection.scope,id)},
   clear:()=>serviceSelection.clear(props.selection.scope)
  }
 };
 return <View style={{flex:1,minHeight:0,paddingBottom:88,backgroundColor:colors.canvas}} testID="live-service-experience"><ExperienceContext.Provider value={runtime}><ExperienceView/></ExperienceContext.Provider></View>;
}
