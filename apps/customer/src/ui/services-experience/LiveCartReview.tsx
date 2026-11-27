import {presentationTitle,presentationSummary} from '../../lib/service-presentation';
import React,{useEffect,useMemo,useState} from 'react';
import {previewSelectionPrice} from '../../lib/selection-price-preview';
import {useExperienceRuntime} from './runtime';
import {displayName,serviceCaption} from './display-labels';
import type {MenuService} from './model';
const money=(paisa:number)=>'₹'+(paisa/100).toLocaleString('en-IN');
export function LiveCartReview({onClose,onDetails}:{onClose:()=>void;onDetails:(service:MenuService)=>void}){
 const runtime=useExperienceRuntime(),{cart,pricingVehicle:car}=runtime;
 const {selected,invalidSelection,scopeIssue}=cart.state;
 const key=JSON.stringify([runtime.selection.scope,cart.ids,car.category,selected]);
 const [review,setReview]=useState<{key:string;total:number;minutes:number}|null>(null),[error,setError]=useState<string|null>(null),[attempt,setAttempt]=useState(0);
 useEffect(()=>{setReview(null);setError(null);if(!selected.length||invalidSelection||scopeIssue||!car.category)return;let alive=true;void previewSelectionPrice(selected,car.category).then(result=>{if(alive&&Number.isSafeInteger(result.total)&&result.total>=0)setReview({key,...result});else if(alive)setError('A current price could not be confirmed.')}).catch(()=>{if(alive)setError('The selected work needs review. Check the services or try again before choosing a time.')});return()=>{alive=false}},[key,attempt]);
 const priced=review?.key===key;
 const canBook=!!cart.ids.length&&!invalidSelection&&!scopeIssue&&!!car.category&&priced;
 return <><p className="mini-label">Nothing is booked or charged yet.</p><div className="cart-list">{cart.ids.map(id=>{const service=runtime.services.find(s=>s.id===id);return <article className="cart-review-row" key={id} data-service-id={id}><div>{service?<><span className="mini-label">{serviceCaption(service)}</span><h3><button className="text-btn" onClick={()=>onDetails(service)} data-original-name={service.name}>{presentationTitle(service)}</button></h3><p className="choice-description">{presentationSummary(service)}</p><strong>{runtime.price(service)}</strong></>:<strong>Service no longer available</strong>}</div><button className="cart-remove" onClick={()=>cart.remove(id)} aria-label={'Remove from cart '+(service?.name||'unavailable service')}>Remove</button></article>})}</div>
 {!cart.ids.length?<p>Your cart is empty. Choose services to start a visit.</p>:null}
 {invalidSelection?<p role="alert">A selected service is no longer available. Remove it before continuing.</p>:scopeIssue?<p role="alert">{scopeIssue}</p>:null}
 {!!cart.ids.length&&!invalidSelection&&!scopeIssue? !car.category?<><p>Choose a saved car with its car type before pricing and selecting a time.</p><button className="secondary" onClick={runtime.onChooseCar}>Choose your car</button></>:priced?<div className="cart-total"><span>Service subtotal</span><strong>{money(review.total)}</strong></div>:<p role="status">{error||'Checking the selected service price…'}{error?<button className="text-btn" onClick={()=>setAttempt(n=>n+1)}>Try again</button>:null}</p>:null}
 <div className="modal-actions">{canBook?<button className="primary" onClick={()=>{if(canBook&&review?.key===key)runtime.onBookSelection(cart.ids)}}>Proceed</button>:null}{scopeIssue?<button className="secondary" onClick={()=>runtime.onHelp(selected.map(s=>s.name).join(' + '))}>Ask the studio</button>:null}<button className="secondary" onClick={onClose}>Continue browsing</button></div></>;
}
