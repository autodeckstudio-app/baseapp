import entries from './service-manufacturer-facts.json';
import type {BrandEnquiry} from './brand-enquiries';
export type ManufacturerFacts={source:string;highlights?:Array<{icon:'shield'|'sun'|'wash'|'check';text:string}>;surfaces?:string[];rows:Array<{label:string;value:string}>};
/** Manufacturer information checked 12 Nov 2026. Brand records describe the range,
 * never AutoDeck inventory, an installed warranty or an exact unselected SKU. */
const facts:Record<string,ManufacturerFacts>={
 'xpel-ppf':{source:'https://www.xpel.com/en-in/products/ultimate-plus',rows:[{label:'ULTIMATE PLUS',value:'Self-healing paint protection film for minor scratches and swirl marks'},{label:'Finishes',value:'Clear and black versions'}]},
 'avvyx-ppf':{highlights:[{icon:'shield',text:'Minor-scratch protection'},{icon:'sun',text:'UV protection'},{icon:'check',text:'Stain resistance'},{icon:'check',text:'Original colour retained'}],surfaces:['Painted bodywork'],source:'https://avvyx.com/clear-ppf/',rows:[{label:'What it is',value:'Transparent paint protection film that preserves your car’s original colour.'},{label:'What it does',value:'Helps protect paint from minor scratches, stains, UV damage and environmental wear.'},{label:'Where it applies',value:'Painted exterior bodywork.'},{label:'Clear film ranges',value:'Prime · Shield · Guard · Armor'}]},
 'llumar-ppf':{source:'https://llumar.com/en/paint-protection-film/',rows:[{label:'Finishes',value:'Gloss and matte films'},{label:'Surface',value:'Self-healing film; properties depend on the selected range'}]},
 'garware-ppf':{source:'https://www.garwareppf.com/',rows:[{label:'Finishes',value:'Gloss, matte, black and white films'},{label:'Surface',value:'Self-healing and stain resistance'},{label:'Coverage options',value:'Partial, full front and full vehicle'}]},
 'avery-dennison-ppf':{source:'https://graphics.averydennison.com/eu-en/home/graphics-products/vehicle-wrapping-films/spf-dir-series.html',rows:[{label:'Range',value:'Supreme Protection Films DIR Series'},{label:'Material',value:'Transparent thermoplastic polyurethane (TPU)'},{label:'Finishes',value:'Clear gloss or matte'}]},
 'nar-ppf':{source:'https://www.narppf.com/',rows:[{label:'Coating',value:'Hydrogen-bond coating technology'},{label:'Surface',value:'Self-healing, anti-oxidation and anti-yellowing properties'}]},
 'gswf-ppf':{source:'https://gswf.com/products/',rows:[{label:'Clear range',value:'Defender Series TPU-based paint protection film'},{label:'Finish',value:'Designed to enhance paint depth and gloss'},{label:'Surface',value:'Self-healing and easy maintenance'}]},
 'rodim-ppf':{source:'https://rodim.in/',rows:[{label:'Range',value:'RODIM paint protection film by BASF'},{label:'Options',value:'R1, R2, R2 matte and R3'}]},
};
// Only range-level facts for brand pages; no SKU-specific warranty or stock claims.
for(const [key,what,benefits,surfaces] of [
 ['llumar-ppf','Self-healing paint protection films in gloss and matte finishes.',['Self-healing surface','Gloss or matte options'],['Paintwork']],
 ['garware-ppf','Paint protection film in gloss, matte, black and white options.',['Self-healing surface','Stain resistance','UV protection'],['Paintwork']],
 ['xpel-ppf','XPEL paint protection film; ULTIMATE PLUS is its self-healing clear-film range.',['Minor-scratch resistance','Stone-chip protection','Clear & black PLUS options'],['Paintwork']],
 ['avery-dennison-ppf','Transparent TPU film in the Supreme Protection Films DIR Series.',['Stone-chip protection','Gloss or matte finish','Self-healing surface'],['Paintwork']],
 ['nar-ppf','Paint protection film with hydrogen-bond coating technology.',['Self-healing surface','Anti-yellowing properties','Anti-oxidation properties'],['Paintwork']],
 ['gswf-ppf','TPU-based clear paint protection film in the Defender range.',['Self-healing surface','Gloss enhancement','Non-yellowing film'],['Paintwork']],
] as Array<[string,string,string[],string[]]>){const f=facts[key]!;f.highlights=benefits.map(text=>({icon:text.includes('UV')?'sun':'shield',text}));f.surfaces=surfaces;f.rows=[{label:'What it is',value:what}];}
const named:Record<string,ManufacturerFacts>={
 'XPEL|ULTIMATE PLUS':{source:'https://www.xpel.com/en-in/products/ultimate-plus',rows:[{label:'Protection',value:'Self-healing film for minor scratches and swirl marks'},{label:'Construction',value:'India product page lists 8 mil film'}]},
 'XPEL|ULTIMATE FUSION':{source:'https://www.xpel.com/en-in/products/ultimate-fusion',rows:[{label:'Surface',value:'Paint protection film with a hydrophobic topcoat'},{label:'Maintenance',value:'Water-repelling surface designed for easier cleaning'}]},
 'XPEL|STEALTH':{source:'https://www.xpel.com/en-in/products/stealth',rows:[{label:'Finish',value:'Satin; can preserve satin paint or change gloss to a matte appearance'},{label:'Protection',value:'Designed for scratches, stone chips and road debris'}]},
 'LLumar|Valor PPF':{source:'https://llumar.com/en/paint-protection-film/',rows:[{label:'Surface',value:'2-in-1 PPF and ceramic-coating benefits'},{label:'Finish',value:'Deep gloss and a hydrophobic surface'}]},
 'LLumar|Platinum Extra PPF':{source:'https://llumar.com/en/paint-protection-film/',rows:[{label:'Construction',value:'Thicker film for higher-impact areas'},{label:'Use',value:'Designed for gravel roads, track use and harsh weather'}]},
 'LLumar|Platinum Gloss PPF':{source:'https://llumar.com/en/paint-protection-film/',rows:[{label:'Finish',value:'High-shine topcoat'},{label:'Surface',value:'HydroGard stain resistance'}]},
 'LLumar|Platinum Matte PPF':{source:'https://llumar.com/en/paint-protection-film/',rows:[{label:'Finish',value:'Flat matte finish'},{label:'Surface',value:'Water-beading, stain-resistant and self-healing'}]},
 'Garware|Matte PPF':{source:'https://www.garwareppf.com/',rows:[{label:'Finish',value:'Matte surface appearance'},{label:'Surface',value:'Self-healing, hydrophobic and stain-resistant'}]},
 'Garware|Black PPF':{source:'https://www.garwareppf.com/',rows:[{label:'Finish',value:'Black high-gloss film'},{label:'Surface',value:'Self-healing and stain-resistant'}]},
 'Garware|White PPF':{source:'https://www.garwareppf.com/',rows:[{label:'Finish',value:'White high-gloss film'},{label:'Surface',value:'Self-healing and stain-resistant'}]},
 'Kovalent|Prolong Light':{source:'https://kovalentcoatings.com/products/prolong-light/',rows:[{label:'Surface',value:'Professional nano ceramic coating for painted surfaces'},{label:'Finish',value:'Gloss enhancement and hydrophobic water repellency'}]},
 'Kovalent|Overlay':{source:'https://kovalentcoatings.com/products/overlay-ppf-coating/',rows:[{label:'Application',value:'Coating for solvent-resistant paint protection films, not a substitute for PPF'},{label:'Technology',value:'Silicon dioxide (SiO₂) formulation'},{label:'Surface',value:'Hydrophobic finish designed to make PPF easier to clean'}]},
 'Kovalent|Matte':{source:'https://kovalentcoatings.com/products/matte/',rows:[{label:'Finish',value:'Preserves the non-reflective appearance of matte paint; formulated without gloss enhancers'},{label:'Surface',value:'Hydrophobic protection against environmental contaminants, oxidation and UV rays'}]},
 'Kovalent|Fabric':{source:'https://kovalentcoatings.com/products/fabric/',rows:[{label:'Suitable surfaces',value:'Textile and fabric materials, including fabric car seats and upholstery'},{label:'Protection',value:'Liquid repellency and stain resistance while preserving breathability'},{label:'Water resistance',value:'Hydrophobic, not fully waterproof'}]},
 'Koch-Chemie|Ceramic Body Cb0.01':{source:'https://www.koch-chemie.com/en/products/ceramic_body_cb001',rows:[{label:'Suitable surfaces',value:'Painted exterior bodywork'},{label:'Surface',value:'Water-beading ceramic seal with easy-to-clean properties'}]},
 'Koch-Chemie|Ceramic Rims Cr0.01':{source:'https://www.koch-chemie.com/en/products/ceramic_rims_cr001',rows:[{label:'Suitable surfaces',value:'Painted rims'},{label:'Protection',value:'Ceramic seal against salt and brake-dust buildup'},{label:'Surface',value:'Water-beading finish designed for easier hand washing'}]},
 'Koch-Chemie|Ceramic Neo C0.03':{source:'https://www.koch-chemie.com/en/products/ceramic_neo_c003',rows:[{label:'Suitable surfaces',value:'Painted exterior vehicle surfaces'},{label:'Finish',value:'Hydrophobic sealant with colour enhancement and deep gloss'},{label:'Protection',value:'Resistance to UV radiation, road salt, bird droppings and rust film'}]},
 'Kovalent|Graphene Matrix':{source:'https://kovalentcoatings.com/products/graphene-matrix/',rows:[{label:'Surface',value:'Graphene ceramic coating with gloss and hydrophobic properties'},{label:'Paint compatibility',value:'Manufacturer excludes matte paint surfaces'},{label:'Self-healing',value:'Manufacturer specifies heat activation at approximately 100°C'}]},
 'Koch-Chemie|Ceramic Allround C0.02':{source:'https://www.koch-chemie.com/en/products/ceramic_allround_c002',rows:[{label:'Surface',value:'Hydrophobic ceramic coating'},{label:'Suitable surfaces',value:'Exterior paintwork, plastics and rims'},{label:'Aftercare',value:'Manufacturer says first wash after nine days at the earliest; curing can take longer below 15°C'}]},
};
export function referenceManufacturerFacts(item:BrandEnquiry):ManufacturerFacts|null{
 if(item.level==='brand')return facts[item.key]??null;
 const direct=entries.find(x=>x.brand===item.brand&&x.names.includes(item.name));
 return direct?{source:direct.source,rows:direct.rows,...("highlights" in direct?{highlights:direct.highlights as NonNullable<ManufacturerFacts["highlights"]>}:{}),...("surfaces" in direct?{surfaces:direct.surfaces as string[]}: {})}:named[`${item.brand}|${item.name}`]??null;
}
