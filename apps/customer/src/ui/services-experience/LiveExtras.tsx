import React from 'react';
import {PPF_CUSTOMER_OPTIONS} from '@autodeck/core';
import {catalogueReferences} from '../../lib/catalogue-references';
import {referenceChoices,referencePlacement,servicePlacement} from '../../lib/services-navigation';
import {ServicesExplorer,ReferencePackageCard} from '../ServicesExplorer';
import {useExperienceRuntime} from './runtime';
import {detailZones,garageZones,type Home} from './model';
export function LiveExtras({home,family}:{home:Home;family?:string|undefined}){
 const runtime=useExperienceRuntime(),rows=runtime.original;
 const ppfWork=home==='paint'&&family==='PPF'&&runtime.path.work&&runtime.path.work!=='full_body';
 const references=referenceChoices(rows,catalogueReferences()).filter(r=>{const p=referencePlacement(r);return p.home===home&&(!family||p.family===family)});
 const mapped=home==='detailing'?detailZones.flatMap(z=>z.families):home==='garage'?garageZones.flatMap(z=>z.families):home==='modifications'?['Colour PPF','Wraps','Window tint']:home==='washing'?['Exterior wash','Interior cleaning','Complete wash']:home==='paint'?['Ceramic','PPF','PPS']:null;
 const other=rows.filter(s=>{const p=servicePlacement(s);return p?.home===home&&mapped&&!mapped.includes(p.family)});
 if(ppfWork)return <section className="live-supplement"><ServicesExplorer services={rows} path={runtime.path} query="" onPath={runtime.onPath} onOpen={s=>runtime.onOpen(s.id)} onHelp={runtime.onHelp} onReference={r=>runtime.onHelp(r.name)} onQuote={s=>runtime.onHelp(s.name)} priceLabel={runtime.priceLabel} onSelectForVisit={s=>{const view=runtime.services.find(x=>x.id===s.id);if(view)runtime.cart.toggle(view)}} selectedForVisit={runtime.cart.ids}/></section>;
 return <>{home==='paint'&&family==='PPF'?<section className="live-supplement" aria-label="Other PPF work"><h2>Other PPF work</h2><div className="row-tools">{PPF_CUSTOMER_OPTIONS.filter(option=>option.key!=='full_body').map(option=><button className="secondary" key={option.key} onClick={()=>runtime.onPath({home:'paint',family:'PPF',work:option.key})}>{option.label}</button>)}</div><p className="mini-label">Partial, front-only and custom coverage are handled offline. Ask the studio to confirm the work.</p></section>:null}
 {other.length?<section className="live-supplement"><h2>More {home==='garage'?'garage services':home==='modifications'?'modifications':'detailing services'}</h2>{other.map(s=><article className="service-row" key={s.id}><h3>{s.name}</h3><p>{s.description}</p><strong>{runtime.priceLabel(s)||'Checking price…'}</strong><button className="secondary" onClick={()=>runtime.onOpen(s.id)}>View details</button></article>)}</section>:null}
 {references.length?<section className="live-supplement"><h2>Ask about products</h2><p className="mini-label">Reference information only. Availability, scope and price need studio confirmation.</p>{references.map(reference=><ReferencePackageCard key={reference.key} item={reference} onPress={()=>runtime.onHelp(reference.name)}/>)}</section>:null}</>;
}
