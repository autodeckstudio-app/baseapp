import{websiteText}from'../lib/website-text';
type Row={id:string;name:string;description:string;customerMenu:{home:string;family:string}};
const root=document.querySelector<HTMLElement>('[data-public-catalogue-home]');
if(root){
 const container=root;
 const home=container.dataset.publicCatalogueHome!,familyFilter=container.dataset.publicCatalogueFamily;
 let active=false,stopped=false;
 async function refresh(){
  if(active||stopped||document.visibilityState==='hidden')return;active=true;
  try{
   const response=await fetch('https://asia-south1-autodeck-studio.cloudfunctions.net/getPublicCatalogue',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Unavailable');
   const data=await response.json();if(typeof data.publishId!=='string'||typeof data.hash!=='string'||!Array.isArray(data.services)||!Array.isArray(data.references))throw Error('Invalid catalogue');
   const rows:Row[]=data.services.filter((r:Row)=>r.customerMenu?.home===home&&(!familyFilter||r.customerMenu.family===familyFilter));
   const refs=data.references.map((reference:any)=>({...reference,home:reference.customerMenu?.home??(reference.surface==='colour-ppf'?'modifications':reference.group==='ppf'?'paint':'detailing'),family:reference.customerMenu?.family??(reference.surface==='colour-ppf'?'Colour PPF':reference.group==='ppf'?(reference.key==='pps-spray'?'PPS':'PPF'):null)})).filter((r:any)=>r.home===home&&r.family&&(!familyFilter||r.family===familyFilter));
   const fragment=document.createDocumentFragment();const families:string[]=[...new Set<string>([...rows.map(r=>r.customerMenu.family),...refs.map((r:any)=>r.family as string)])];
   for(const family of families){const section=document.createElement('section');section.className='service-next';section.dataset.serviceFamily=family;section.id='service-'+family.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');
    const title=document.createElement('h2');title.textContent=websiteText(family);section.append(title);const links=document.createElement('div');links.className='service-links';
    for(const row of rows.filter(r=>r.customerMenu.family===family)){if(!row.id||!websiteText(row.name))throw Error('Invalid service');const a=document.createElement('a');a.href='https://app.autodeck.in/catalogue/'+encodeURIComponent(row.id);const name=document.createElement('span');name.textContent=row.name;if(row.description){const detail=document.createElement('small');detail.textContent=websiteText(row.description);name.append(detail)}a.append(name);links.append(a)}for(const reference of refs.filter((r:any)=>r.family===family)){const a=document.createElement('a');const q=new URLSearchParams({home,family});a.href='https://app.autodeck.in/catalogue?'+q.toString();const name=document.createElement('span');name.textContent=websiteText((reference.brand&&!reference.name.startsWith(reference.brand)?reference.brand+' ':'')+reference.name);if(!name.textContent)throw Error('Invalid reference');a.append(name);links.append(a)}section.append(links);fragment.append(section);
   }
   if(!fragment.childNodes.length){const p=document.createElement('p');p.textContent='No service is currently published in this section.';fragment.append(p);}
   const choiceRoot=document.querySelector('[data-public-catalogue-choices]');if(choiceRoot){const choices=document.createDocumentFragment();for(const family of families){const a=document.createElement('a');a.href='#service-'+family.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');const span=document.createElement('span');span.textContent=websiteText(family);a.append(span);choices.append(a)}choiceRoot.replaceChildren(choices);}
   container.replaceChildren(fragment);container.dataset.publicationId=data.publishId;container.dataset.publicationHash=data.hash;container.removeAttribute('aria-busy');
  }catch{document.querySelector('[data-public-catalogue-choices]')?.replaceChildren();const p=document.createElement('p');p.textContent='Current services could not be checked. Please try again.';const retry=document.createElement('button');retry.className='solid';retry.textContent='Retry services';retry.addEventListener('click',()=>void refresh());container.replaceChildren(p,retry);container.removeAttribute('data-publication-id');container.removeAttribute('data-publication-hash');container.removeAttribute('aria-busy');}
  finally{active=false;}
 }
 void refresh();let timer=setInterval(()=>void refresh(),60000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refresh()});window.addEventListener('focus',()=>void refresh());window.addEventListener('pagehide',()=>{stopped=true;clearInterval(timer)});window.addEventListener('pageshow',event=>{if(event.persisted){stopped=false;clearInterval(timer);timer=setInterval(()=>void refresh(),60000);void refresh()}});
}
