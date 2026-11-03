import { describe,it,expect } from 'vitest';
import { showcaseFor } from './showcase';
describe('current catalogue service scope',()=>{
 it('handles every new name without a legacy-name lookup',()=>{expect(showcaseFor({name:'Brand new service',description:'Current approved description.'}).included).toEqual(['Current approved description.']);});
 it('keeps listed multiline inclusions and removes only bullet formatting',()=>{expect(showcaseFor({name:'Detail SPA',description:'Detailing spa.\n- Engine cleaning\n- Under body cleaning'}).included).toEqual(['Detailing spa.','Engine cleaning','Under body cleaning']);});
 it('never invents legacy wash steps or editorial picks',()=>{const s=showcaseFor({name:'Regular Wash',description:'Exterior foam wash and dry.'});expect(s.included).toEqual(['Exterior foam wash and dry.']);expect(s.benefits).toEqual([]);expect(s.studioPick).toBeUndefined();});
 it('missing copy stays missing instead of fabricating scope',()=>{expect(showcaseFor({name:'New service',description:''}).included).toEqual([]);});
});
