import {it,expect} from 'vitest';
import {compareSafe,nextComparison,alternatives} from './model';
import type {MenuService} from './model';
const service=(id:string,scope:string)=>({id,active:true,comparisonScope:scope,customerMenu:{home:'paint',family:'PPF'}} as MenuService);
it('keeps full-body, removal and replacement in separate comparison scopes',()=>{const rows=[service('body','full_body'),service('remove','removal'),service('replace','replacement')];expect(compareSafe(rows,['body','remove']).map(s=>s.id)).toEqual(['body']);expect(alternatives(rows,rows[1]!)).toEqual([rows[1]]);expect(nextComparison(rows,['body'],rows[1]!)).toEqual(['remove'])});
it('drops withdrawn comparison IDs rather than reviving a fixture record',()=>expect(compareSafe([service('body','full_body')],['withdrawn','body']).map(s=>s.id)).toEqual(['body']));
