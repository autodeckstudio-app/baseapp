import React from 'react';import{test,expect,vi}from'vitest';import{act,create}from'react-test-renderer';
vi.mock('../../lib/choice-media-web',()=>({choiceMediaURLs:(id:string)=>({product:'/fixture/'+id+'.webp'})}));
import{ColourProductMedia}from'./ColourProductMedia';
test('selected approved colour image follows exact service and keeps built-image provenance',async()=>{
 let view:ReturnType<typeof create>;
 await act(async()=>{view=create(<ColourProductMedia service={{id:'svc_552372faf2dc835012f3321d1982a712',name:'NAR Colour PPF'}}/>)});
 expect(view!.root.findByType('figure').props.style.overflow).toBe('hidden');expect(view!.root.findByType('img').props.style.objectFit).toBe('cover');expect(view!.root.findByType('figcaption').props.style.position).toBe('absolute');expect(JSON.stringify(view!.toJSON())).toContain('NAR Colour PPF product');expect(JSON.stringify(view!.toJSON())).toContain('Illustrative product render.');
 await act(async()=>{view!.update(<ColourProductMedia service={{id:'svc_dff9bd93656be1706fc7828bff78ac66',name:'GSWF Colour PPF'}}/>)});
 expect(JSON.stringify(view!.toJSON())).toContain('GSWF Colour PPF product');expect(JSON.stringify(view!.toJSON())).not.toContain('Illustrative product render.');
 await act(async()=>{view!.update(<ColourProductMedia service={{id:'held',name:'Held'}}/>)});expect(view!.toJSON()).toBeNull();
 await act(async()=>view!.unmount());
});
