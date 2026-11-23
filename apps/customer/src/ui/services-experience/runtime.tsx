import React,{createContext,useContext} from 'react';
import type {Service} from '@autodeck/core';
import type {ServicesPath} from '../../lib/services-navigation';
import type {useServiceSelection} from '../../hooks/useServiceSelection';
import type {usePricingVehicle} from '../../lib/vehicle-size';
import type {cartSelectionState,toggleCartService} from '../../lib/service-cart';
import type {MenuService} from './model';
export type ServiceExperienceProps={services:Service[];path:ServicesPath;selection:ReturnType<typeof useServiceSelection>;pricingVehicle:ReturnType<typeof usePricingVehicle>;priceLabel:(service:Service)=>string|null|undefined;onPath:(path:ServicesPath)=>void;onOpen:(service:Service)=>void;onHelp:(text:string)=>void;onCoordinate:(ids:readonly string[])=>void;onBookSelection:(ids:readonly string[])=>void;onChooseCar:()=>void;onBack?:((()=>void)|undefined);onVisitRequests?:((()=>void)|undefined);refreshError:boolean;onRefresh:()=>void};
export type ExperienceRuntime=Omit<ServiceExperienceProps,'services'|'onOpen'> & {services:MenuService[];original:Service[];theme:'light'|'night';eligible:(service:MenuService)=>boolean;price:(service:MenuService)=>string;onOpen:(id:string)=>void;cart:{ids:readonly string[];state:ReturnType<typeof cartSelectionState>;toggle:(service:MenuService)=>ReturnType<typeof toggleCartService>;remove:(id:string)=>void;clear:()=>void}};
export const ExperienceContext=createContext<ExperienceRuntime|null>(null);
export function useExperienceRuntime(){const value=useContext(ExperienceContext);if(!value)throw new Error('Service experience requires its real catalogue and owner-scoped selection');return value;}
