import {it,expect,vi,beforeEach} from 'vitest';import {create,act} from 'react-test-renderer';import {createElement as h} from 'react';
const api=vi.hoisted(()=>({options:vi.fn(),join:vi.fn()}));vi.mock('../lib/visit-service',()=>({getVisitJoinOptions:(...a:any[])=>api.options(...a),joinVisit:(...a:any[])=>api.join(...a)}));
vi.mock('../lib/studio-service',()=>({onStaffAuthChanged:(cb:any)=>{cb({uid:'staff',role:'studio',tenantId:'t',studioId:'s'});return()=>{}}}));
import {JoinVisit} from './JoinVisit';
const job:any={id:'wash',tenantId:'t',studioId:'s',status:'IN_PROGRESS',visitId:'visit',updatedAt:'same'};
beforeEach(()=>{api.options.mockReset();api.join.mockReset();api.join.mockResolvedValue({visitId:'visit'});api.options.mockResolvedValue({jobId:'wash',expectedUpdatedAt:'same',existingVisit:{visitId:'visit',expectedRevision:4},members:[{jobId:'wash',expectedUpdatedAt:'same',service:'Wash'},{jobId:'ceramic',expectedUpdatedAt:'other',service:'Ceramic'}],options:[{jobId:'lamp',expectedUpdatedAt:'new',service:'Lamp',status:'Not started',scheduledDate:'2026-11-14'}],bounded:false})});
it('existing visit addition includes every current member and explicit new selection, never a guessed join',async()=>{
 let tree:any;await act(async()=>{tree=create(h(JoinVisit,{job}))});const button=(label:string)=>tree.root.findAll((n:any)=>n.props.label===label&&n.props.onPress)[0];
 await act(async()=>button('Same visit').props.onPress());expect(api.join).not.toHaveBeenCalled();expect(JSON.stringify(tree.toJSON())).toContain('Current visit');
 await act(async()=>tree.root.findAll((n:any)=>n.props.accessibilityRole==='checkbox'&&n.props.onPress)[0].props.onPress());
 await act(async()=>button('Confirm same visit').props.onPress());expect(api.join).toHaveBeenCalledWith({operationId:expect.any(String),confirmed:true,existingVisit:{visitId:'visit',expectedRevision:4},members:[{jobId:'wash',expectedUpdatedAt:'same'},{jobId:'ceramic',expectedUpdatedAt:'other'},{jobId:'lamp',expectedUpdatedAt:'new'}]});await act(async()=>tree.unmount());
});
it('a stale options response cannot open choices on another car or mutate either visit',async()=>{let resolve:any;api.options.mockImplementationOnce(()=>new Promise(r=>resolve=r));let tree:any;await act(async()=>{tree=create(h(JoinVisit,{job}))});const button=(label:string)=>tree.root.findAll((n:any)=>n.props.label===label&&n.props.onPress)[0];
 let loading:any;await act(async()=>{loading=button('Same visit').props.onPress()});await act(async()=>tree.update(h(JoinVisit,{job:{...job,id:'other',vehicleId:'another',visitId:'visit2'}})));await act(async()=>{resolve({jobId:'wash',options:[],bounded:false});await loading});expect(JSON.stringify(tree.toJSON())).not.toContain('Current visit');expect(api.join).not.toHaveBeenCalled();await act(async()=>tree.unmount());
});
