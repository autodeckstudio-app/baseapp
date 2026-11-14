import{it,expect,vi}from'vitest';
const h=vi.hoisted(()=>({rows:[]as any[]}));
vi.mock('./firebase',()=>({db:{},functions:{}}));vi.mock('firebase/functions',()=>({httpsCallable:()=>async()=>({data:{services:h.rows}})}));
import{getActiveServices}from'./approval-service';
it('new work only offers the final Customer menu, while existing job labels keep the operational active records',async()=>{h.rows=[{id:'menu-wash-exterior',name:'Exterior wash',active:true,category:'washing',displayOrder:1},{id:'legacy-active',name:'Legacy work',active:true,category:'other',displayOrder:2},{id:'hidden',name:'Hidden work',active:false}];expect((await getActiveServices()).map(s=>s.id)).toEqual(['menu-wash-exterior']);expect((await getActiveServices({catalogueOnly:false})).map(s=>s.id)).toEqual(['menu-wash-exterior','legacy-active'])});
