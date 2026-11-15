const samplePhoto='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="540" viewBox="0 0 900 540"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#b9b5ad"/><stop offset="1" stop-color="#5e6267"/></linearGradient></defs><rect width="900" height="540" fill="url(#bg)"/><text x="450" y="60" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#333">LOCAL ILLUSTRATION - NOT A CUSTOMER PHOTO</text><path d="M170 290 L240 210 L600 210 L700 290 L740 320 L730 380 L150 380 L140 330 Z" fill="#e8e6df" stroke="#777" stroke-width="5"/><path d="M270 225 L365 225 L365 280 L225 280 Z M385 225 L585 225 L650 280 L385 280 Z" fill="#494e54"/><circle cx="265" cy="375" r="52" fill="#25272a"/><circle cx="630" cy="375" r="52" fill="#25272a"/><circle cx="265" cy="375" r="28" fill="#999"/><circle cx="630" cy="375" r="28" fill="#999"/></svg>`);
const car=(id:string,make:string,model:string,year:number,updatedAt:string)=>({id,make,model,year,updatedAt,registrationNumber:`SAMPLE ${id}`,tenantId:'sample',ownerId:'sample-owner',category:'suv',photoUrl:new URLSearchParams(location.search).has('photos')?samplePhoto:null,deletedAt:null,createdAt:updatedAt});
export const CARS=[car('A','Kia','Seltos',2020,'2026-11-11T01:00:00Z'),car('B','Kia','Sonet',2025,'2026-11-10T01:00:00Z'),car('C','BMW','X1',2023,'2026-11-09T01:00:00Z')];
export const useAuth=()=>({status:'ready',customerDocId:'sample-owner',customerDocResolution:'resolved',user:{uid:'sample-auth'},claims:{tenantId:'sample',role:'customer'}});
export const setActiveVehicle=async(id:string)=>{document.body.dataset.activeCar=id};
export const listenToMyVehicles=(_u:any,_t:any,cb:any)=>{cb(CARS);return()=>{}};
export const listenToMyArchivedVehicles=()=>()=>{};
export const deleteVehiclePermanently=()=>{throw new Error('LOCAL READ ONLY')};export const restoreVehicle=deleteVehiclePermanently;
export const listenToMyJobs=(_t:any,_o:any,cb:any)=>{cb([]);return()=>{}};
export const listenToMyMemberships=(_t:any,_o:any,cb:any)=>{cb([]);return()=>{}};
export const getServiceCatalogue=async()=>[];
export const listenToVehiclePapers=(_v:any,_t:any,_u:any,cb:any)=>{cb([]);return()=>{}};
export const daysUntil=()=>null;
export const devGarage=null,devGarageDetail=null;

export const resolveVehiclePhotoUrl=async(path:string)=>path.startsWith('data:image/')?path:null;

export const db={},functions={},auth={},storage={};
