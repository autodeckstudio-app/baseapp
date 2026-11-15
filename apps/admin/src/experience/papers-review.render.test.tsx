import React from 'react';import {act,create} from 'react-test-renderer';import {it,expect,vi} from 'vitest';
import {PapersView} from './PapersView';
it('review requires words, original inspection and a plate read from it, with explicit error and retry',async()=>{
 const onReview=vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true),onOpenEvidence=vi.fn().mockResolvedValue(null);
 const paper:any={id:'p',kind:'INSURANCE',reference:'POL1',expiresOn:null,status:'PENDING',vehicleId:'v',verificationMode:'review',verificationReason:'Plate mismatch. Needs review.'};let r:any;
 await act(async()=>{r=create(<PapersView filter="PENDING" papers={[paper]} vehiclesById={new Map()} loading={false} busy={false} error={null} message={null} onFilter={()=>{}} onResolvePlate={async()=>null} onSubmit={()=>{}} onReview={onReview} onOpenEvidence={onOpenEvidence}/>)});
 const btn=(label:string)=>r.root.findAllByType('button').find((b:any)=>b.children.includes(label));
 await act(async()=>btn('Load original document').props.onClick());expect(onOpenEvidence).toHaveBeenCalledWith('p');expect(JSON.stringify(r.toJSON())).toContain('No uploaded original is available');
 await act(async()=>btn('Review & verify').props.onClick());expect(onReview).not.toHaveBeenCalled();expect(btn('Confirm verification').props.disabled).toBe(true);
 await act(async()=>r.root.findByProps({'aria-label':'Plate printed on original document'}).props.onChange({target:{value:'GJ01AB1234'}}));expect(btn('Confirm verification').props.disabled).toBe(true);
 await act(async()=>r.root.findAllByType('input').find((i:any)=>i.props.type==='checkbox').props.onChange({target:{checked:true}}));expect(btn('Confirm verification').props.disabled).toBe(false);
 await act(async()=>btn('Confirm verification').props.onClick());expect(onReview).toHaveBeenLastCalledWith(paper,'VERIFIED','','GJ01AB1234');expect(btn('Confirm verification')).toBeTruthy();
 await act(async()=>btn('Confirm verification').props.onClick());expect(btn('Review & verify')).toBeTruthy();await act(async()=>r.unmount());
});
