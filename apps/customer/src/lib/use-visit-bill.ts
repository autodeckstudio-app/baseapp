import{useEffect,useState}from'react';
import type{VisitRead,VisitBillRead}from'@autodeck/core';
import{getVisitBill}from'./visit-service';
export function useVisitBill(view:VisitRead|null|undefined){
 const[state,setState]=useState<{view:VisitRead;bill:VisitBillRead|null;error:boolean}|null>(null);
 useEffect(()=>{let alive=true;setState(null);if(view?.status==='grouped')getVisitBill(view).then(bill=>{if(alive)setState({view,bill,error:false})}).catch(()=>{if(alive)setState({view,bill:null,error:true})});return()=>{alive=false}},[view]);
 return state&&state.view===view?{bill:state.bill,error:state.error}:{bill:null,error:false};
}
