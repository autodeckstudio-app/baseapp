import React,{useEffect,useRef} from 'react';
import {installCategorySwipe} from './category-swipe';
import {Asset} from 'expo-asset';
import detailing from '../../../assets/imagery/category/detailing.jpg';
import paint from '../../../assets/imagery/category/paint-protection.jpg';
import garage from '../../../assets/imagery/category/garage.jpg';
import modifications from '../../../assets/imagery/category/modifications.jpg';
const uri=(source:string|number)=>typeof source==='string'?source:Asset.fromModule(source).uri;
const scenes={detailing:uri(detailing),paint:uri(paint),garage:uri(garage),modifications:uri(modifications)};
import type {Home} from "./model";
import {labels} from './model';

const categoryTabs:[Home|null,string][]=[[null,'All'],['washing','Wash & care'],['paint','Paint protection'],['detailing','Detailing'],['garage','Garage'],['modifications','Modifications & wraps']];
export function ServiceCategoryTabs({selected,onBrowse}:{selected:Home|null;onBrowse:(home:Home|null)=>void}){
 const nav=useRef<HTMLElement>(null);
 useEffect(()=>nav.current?installCategorySwipe(nav.current):undefined,[]);
 useEffect(()=>{nav.current?.querySelector('[aria-current="page"]')?.scrollIntoView({inline:'nearest',block:'nearest',behavior:'instant'})},[selected]);
 return <nav ref={nav} className="service-area-shortcuts" aria-label="Service areas">{categoryTabs.map(([home,label])=><button type="button" key={home??'all'} aria-current={selected===home?'page':undefined} onClick={()=>onBrowse(home)}>{label}</button>)}</nav>;
}
/** Photo-led entry only. All routes continue through the existing catalogue flow. */
export function ServicesLanding({onBrowse}:{onBrowse:(home:Home)=>void}){
 const tile=(home:Home,title:string,kind:string)=><button type="button" className={'service-scene '+kind} onClick={()=>onBrowse(home)} aria-label={'Browse '+labels[home]}><img src={scenes[home as keyof typeof scenes]} alt=""/><span className="service-scene-shade"/><span className="service-scene-copy">{kind==='service-scene-hero'?<small>DETAILING</small>:null}<strong>{title}</strong></span></button>;
 return <div className="services-editorial"><div className="service-scene-grid">{tile('detailing','Complete detailing','service-scene-hero')}{tile('paint','Paint protection','service-scene-half')}{tile('garage','Garage','service-scene-half')}{tile('modifications','Modifications','service-scene-wide')}</div><p className="service-scene-note">Service illustrations</p></div>;
}
export const servicesLandingCSS=`
.services-experience .root-screen{max-width:1040px;margin:0 auto;padding:24px 20px 30px}
.services-experience .root-screen h1{font-size:30px;letter-spacing:-.7px;margin:0 0 8px}
.services-experience .root-intro{margin:0 0 18px;color:var(--muted);font-size:14px}
.services-experience .root-screen .search-field{margin:0 0 15px}
.services-experience .root-screen .search-field>span{display:none}
.services-experience .service-area-shortcuts{display:flex;flex-wrap:nowrap;gap:22px;align-items:center;margin:0 0 20px;min-height:44px;font-size:13px;max-width:100%;overflow-x:auto;overflow-y:hidden;touch-action:pan-y pinch-zoom;-webkit-overflow-scrolling:touch;white-space:nowrap;scrollbar-width:none}.services-experience .service-area-shortcuts::-webkit-scrollbar{display:none}.services-experience .service-area-shortcuts>*{flex-shrink:0}.services-experience .category-tabs-wrap{max-width:1040px;margin:0 auto;padding:0 20px}.services-experience .service-area-shortcuts button[aria-current="page"]{color:var(--ink);border-bottom:2px solid var(--accent)}
.services-experience .service-area-shortcuts>span{align-self:stretch;display:flex;align-items:center;position:relative;color:var(--ink)}
.services-experience .service-area-shortcuts>span:after{content:'';position:absolute;height:2px;bottom:0;left:0;right:0;background:var(--accent)}
.services-experience .service-area-shortcuts button{padding:0;min-height:44px;border:0;background:transparent;color:var(--muted);font:inherit}
.services-experience .service-scene-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;perspective:1200px}
.services-experience .service-scene{position:relative;display:block;overflow:hidden;isolation:isolate;width:100%;border-radius:18px;border:1px solid var(--line);padding:0;background:var(--panel);text-align:left;box-shadow:var(--card-shadow);color:white;transform:translateZ(0);animation:service-scene-arrive .65s cubic-bezier(.2,.8,.2,1) both}
.services-experience .service-scene img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .7s cubic-bezier(.2,.7,.3,1);filter:brightness(.91)}
.services-experience .service-scene-shade{position:absolute;inset:0;background:linear-gradient(180deg,transparent 30%,rgba(5,10,15,.16) 54%,rgba(5,10,15,.94));pointer-events:none}
.services-experience .service-scene-copy{position:absolute;left:16px;right:14px;bottom:17px;z-index:1;display:grid;gap:8px}
.services-experience .service-scene-copy strong{font-size:15px;line-height:1.25;font-weight:650;letter-spacing:-.2px;color:#fff}
.services-experience .service-scene-copy small{font-size:10px;letter-spacing:1.7px;color:#e2d0af}
.services-experience .service-scene-hero{grid-column:1/-1;height:300px;border-radius:25px}
.services-experience .service-scene-hero img{animation:service-photo-settle 7s ease-out both}
@keyframes service-photo-settle{from{transform:scale(1.065)}to{transform:scale(1)}}
.services-experience .service-scene-hero .service-scene-copy strong{font-size:25px}
.services-experience .service-scene-half{height:160px;animation-delay:.06s}
.services-experience .service-scene-half+.service-scene-half{animation-delay:.11s}
.services-experience .service-scene-wide{grid-column:1/-1;height:130px;animation-delay:.16s}
.services-experience .service-scene-wide img{object-position:center}
.services-experience .service-scene-note{font-size:10px;line-height:1.4;color:var(--muted);margin:14px 0 0}
.services-experience .service-scene:focus-visible{outline:2px solid var(--accent);outline-offset:4px}
@media(hover:hover){.services-experience .service-scene:hover img{transform:scale(1.035)}.services-experience .service-scene:hover{border-color:var(--accent)}}
@keyframes service-scene-arrive{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@media(min-width:760px){.services-experience .service-scene-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.services-experience .service-scene-hero{grid-column:1/3;grid-row:1/3;height:420px}.services-experience .service-scene-half{height:204px}.services-experience .service-scene-wide{grid-column:3/5;height:204px}}
@media(prefers-reduced-motion:reduce){.services-experience .service-scene{animation:none}.services-experience .service-scene img{transition:none;animation:none}.services-experience .service-scene:hover img{transform:none}}
`;
