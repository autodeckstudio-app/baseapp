import React from 'react';
import {test,expect,vi} from 'vitest';
import {act,create} from 'react-test-renderer';
vi.mock('../../lib/choice-media-web',()=>({choiceMediaURLs:(id:string)=>id==='image'?{product:'/product.webp',logo:'/logo.png',brand:'Maker',background:'#fff'}:id==='logo'?{product:null,logo:'/logo.png',brand:'Maker',background:'#fff'}:null}));
vi.mock('../../lib/service-presentation',()=>({presentationTitle:(s:{name:string})=>s.name,presentationSummary:()=> 'Existing description'}));
import {ServiceChoiceCard} from './ServiceChoiceCard';
import type {MenuService} from './model';
const service=(id:string)=>({id,name:'Existing service',customerMenu:{family:'Ceramic'}} as MenuService);
test('image card spans text height and has logo beside unchanged actions',async()=>{
 const details=vi.fn(),compare=vi.fn(),action=vi.fn();let view:ReturnType<typeof create>;
 await act(async()=>{view=create(<ServiceChoiceCard service={service('image')} price="Inspection" compareAllowed compared={false} selected={false} actionLabel="Discuss existing service" actionText="Discuss" onDetails={details} onCompare={compare} onAction={action}/>)});
 expect(view!.root.findAllByType('strong')).toHaveLength(1);expect(view!.root.findByProps({className:'choice-side-media'}).findByType('img').props.src).toBe('/product.webp');expect(view!.root.findByProps({className:'choice-price'}).children).toEqual(['Inspection']);
 const actions=view!.root.findByProps({className:'choice-actions'});expect(actions.findByProps({alt:'Maker logo'})).toBeTruthy();
 await act(async()=>{view!.root.findByProps({'aria-label':'Details for Existing service'}).props.onClick();actions.findByProps({'aria-label':'Compare Existing service'}).props.onClick();actions.findByProps({'aria-label':'Discuss existing service'}).props.onClick()});
 expect(details).toHaveBeenCalledOnce();expect(compare).toHaveBeenCalledOnce();expect(action).toHaveBeenCalledOnce();await act(async()=>view!.unmount());
});
test('no-image cards have no media gap, keep price and optional logo in action rail',async()=>{
 let view:ReturnType<typeof create>;const props={price:'₹3,500',compareAllowed:false,compared:false,selected:false,actionLabel:'Discuss',actionText:'Discuss',onDetails:vi.fn(),onCompare:vi.fn(),onAction:vi.fn()};
 await act(async()=>{view=create(<ServiceChoiceCard service={service('none')} {...props}/>)});expect(view!.root.findAllByProps({className:'choice-side-media'})).toHaveLength(0);expect(view!.root.findByProps({className:'choice-price'}).children).toEqual(['₹3,500']);expect(view!.root.findAllByType('img')).toHaveLength(0);
 await act(async()=>view!.update(<ServiceChoiceCard service={service('logo')} {...props}/>));expect(view!.root.findAllByProps({className:'choice-side-media'})).toHaveLength(0);expect(view!.root.findByProps({className:'choice-actions'}).findByType('img').props.alt).toBe('Maker logo');await act(async()=>view!.unmount());
});
