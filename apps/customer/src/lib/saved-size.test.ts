import {describe,it,expect,vi} from 'vitest';import {ensureVehicleSize} from './saved-size';
describe('saved-size booking',()=>{
 it('does not guess missing size',async()=>{const save=vi.fn();await expect(ensureVehicleSize({id:'a',category:null},null,save)).rejects.toThrow('Choose');expect(save).not.toHaveBeenCalled();});
 it('saves old car size once and propagates failures before booking',async()=>{const save=vi.fn().mockResolvedValue(undefined);expect(await ensureVehicleSize({id:'a',category:null},'suv',save)).toBe('suv');expect(save).toHaveBeenCalledWith({vehicleId:'a',category:'suv'});const fail=vi.fn().mockRejectedValue(new Error('offline'));await expect(ensureVehicleSize({id:'a',category:null},'suv',fail)).rejects.toThrow('offline');});
 it('uses saved category when switching cars, without rewriting prices or size',async()=>{const save=vi.fn();expect(await ensureVehicleSize({id:'a',category:'sedan'},'suv',save)).toBe('sedan');expect(await ensureVehicleSize({id:'b',category:'commercial'},null,save)).toBe('commercial');expect(save).not.toHaveBeenCalled();});
});
