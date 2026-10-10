import type {Vehicle,VehicleCategory} from '@autodeck/core';
/** Save missing size once, before booking. Existing stored categories are authoritative. */
export async function ensureVehicleSize(vehicle:Pick<Vehicle,'id'|'category'>,chosen:VehicleCategory|null,save:(input:{vehicleId:string;category:VehicleCategory})=>Promise<void>):Promise<VehicleCategory> {
 if(vehicle.category)return vehicle.category;
 if(!chosen)throw new Error("Choose your car's size before selecting a time.");
 await save({vehicleId:vehicle.id,category:chosen});
 return chosen;
}
