import {it,expect,vi} from 'vitest';
const h=vi.hoisted(()=>({get:vi.fn(),set:vi.fn(async()=>{})}));
vi.mock('@react-native-async-storage/async-storage',()=>({default:{getItem:h.get,setItem:h.set}}));
import{loadVehiclePreference,setVehiclePreference,vehiclePreferenceOwner}from './active-vehicle';
it('owner-scoped keys and serialized rapid choices persist in order, with legacy mirror',async()=>{h.set.mockClear();await Promise.all([setVehiclePreference('t:a','car-a'),setVehiclePreference('t:a','car-b')]);expect(h.set.mock.calls).toEqual([['autodeck.activeVehicle:t:a','car-a'],['autodeck.activeVehicle','car-a'],['autodeck.activeVehicle:t:a','car-b'],['autodeck.activeVehicle','car-b']]);expect(vehiclePreferenceOwner(null,'t')).toBeNull();expect(vehiclePreferenceOwner('a','t')).toBe('t:a')});
it('late initial storage read cannot overwrite a newer choice or write a different owner',async()=>{let resolve:any;h.get.mockImplementation(()=>new Promise(r=>resolve=r));const read=loadVehiclePreference('t:race');await setVehiclePreference('t:race','new-car');resolve('old-car');await read;expect(h.set.mock.lastCall).toEqual(['autodeck.activeVehicle','new-car'])});
