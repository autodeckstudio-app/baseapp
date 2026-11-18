const samplePhoto='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="540" viewBox="0 0 900 540"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#b9b5ad"/><stop offset="1" stop-color="#5e6267"/></linearGradient></defs><rect width="900" height="540" fill="url(#bg)"/><text x="450" y="60" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#333">LOCAL ILLUSTRATION - NOT A CUSTOMER PHOTO</text><path d="M170 290 L240 210 L600 210 L700 290 L740 320 L730 380 L150 380 L140 330 Z" fill="#e8e6df" stroke="#777" stroke-width="5"/><path d="M270 225 L365 225 L365 280 L225 280 Z M385 225 L585 225 L650 280 L385 280 Z" fill="#494e54"/><circle cx="265" cy="375" r="52" fill="#25272a"/><circle cx="630" cy="375" r="52" fill="#25272a"/><circle cx="265" cy="375" r="28" fill="#999"/><circle cx="630" cy="375" r="28" fill="#999"/></svg>`);
const car=(id:string,make:string,model:string,year:number,updatedAt:string)=>({id,make,model,year,updatedAt,registrationNumber:`SAMPLE ${id}`,tenantId:'sample',ownerId:'sample-owner',category:'suv',photoUrl:new URLSearchParams(location.search).has('photos')?samplePhoto:null,deletedAt:null,createdAt:updatedAt});
export const CARS=[car('A','Kia','Seltos',2020,'2026-11-11T01:00:00Z'),car('B','Kia','Sonet',2025,'2026-11-10T01:00:00Z'),car('C','BMW','X1',2023,'2026-11-09T01:00:00Z')];
export const useAuth=()=>({status:'ready',customerDocId:'sample-owner',customerDocResolution:'resolved',user:{uid:'sample-auth',displayName:'Sample customer',email:'sample@example.test',photoURL:null},claims:{tenantId:'sample',role:'customer'}});
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

export const getMyBookings=async()=>[];
export const cancelBooking=async()=>{throw Error('LOCAL READ ONLY')};
export const listenToMyInvoices=(_a:any,_b:any,cb:any)=>{cb([]);return()=>{}};
export const listenToApprovalsForJob=()=>()=>{};
export const loadServiceNames=async()=>({});export const missingNameIds=()=>[];
export const requestAccountDeletion=cancelBooking,cancelAccountDeletion=cancelBooking,uploadLicensePhoto=cancelBooking,signOut=cancelBooking;
export const useSharedVisit=()=>({status:'idle'});
export const listenToNotifications=(_a:any,_b:any,cb:any)=>{cb([]);return()=>{}};
export const listenToMyNotifications=listenToNotifications;
export const bookingFromJob=(x:any)=>({...x,status:"ACTIVE",payMode:"studio",serviceId:"sample-wash",serviceName:"Sample studio wash",notes:"",scheduledAt:"2026-11-18T10:00:00Z",scheduledDate:"2026-11-18",scheduledTime:"15:30",durationMinutes:60,priceBreakdown:{basePrice:250000,scopeAdjustment:0,addOns:[],tax:0,total:250000}});

export const emulatorBackend=false;
export const updateVehicle=cancelBooking,archiveVehicle=cancelBooking,uploadVehiclePhoto=cancelBooking,uploadVehicleRc=cancelBooking,removeVehicleImage=cancelBooking;
export const JOB={id:'sample-job',tenantId:'sample',customerId:'sample-owner',vehicleId:'A',status:'IN_PROGRESS',paymentStatus:'unpaid',totalAmount:250000,services:[{serviceId:'sample-wash',name:'Sample studio wash',quantity:1}],statusHistory:[{status:'VEHICLE_RECEIVED',changedAt:'2026-11-18T10:00:00Z'},{status:'IN_PROGRESS',changedAt:'2026-11-18T10:15:00Z'}],createdAt:'2026-11-18T10:00:00Z'};
export const listenToJobsForVehicle=(_v:any,_t:any,_c:any,cb:any)=>{cb([JOB]);return()=>{}};
export const listenToInvoicesForVehicle=(_v:any,_t:any,_c:any,cb:any)=>{cb([]);return()=>{}};
export const listenToVehicleProtections=listenToInvoicesForVehicle,listenToVehicleWarranties=listenToInvoicesForVehicle;
export const listenToCustomerPapers=(_t:any,_c:any,cb:any)=>{cb([]);return()=>{}};
export const isCalendarDate=(v:any)=>/^\d{4}-\d{2}-\d{2}$/.test(v);
export const updateMyProtection=cancelBooking,submitMyPaper=cancelBooking,updateMyPaper=cancelBooking,deleteMyPaper=cancelBooking;
export const resolvePaperEvidenceUrl=async()=>({url:null,failure:null});
export const listenToBooking=(_id:any,cb:any)=>{cb(null);return()=>{}};
export const listenToJobById=(_id:any,cb:any)=>{cb(JOB);return()=>{}};
export const listenToJobForBooking=(_id:any,_t:any,_c:any,cb:any)=>{cb(JOB);return()=>{}};
export const getJobIdForBooking=async()=>JOB.id;
export const listenToPaymentForJob=(_id:any,_t:any,_c:any,cb:any)=>{cb(null);return()=>{}};
export const approveBookingQuote=cancelBooking,declineBookingQuote=cancelBooking,initiatePayment=cancelBooking,requestAdvancePayment=cancelBooking,payOnline=cancelBooking,payWithPaymentLink=cancelBooking,respondToApproval=cancelBooking,submitReview=cancelBooking;
export const getReview=async()=>null;
export const listenToInspection=(_id:any,cb:any)=>{cb(null);return()=>{}};
export const verifyMyCustomerDocId=async()=>true;
export const getCatalogueDisplayTotals=async()=>({}),cachedServiceTotal=()=>null,priceLabel=()=> 'Price confirmed by studio';
export const listenToPickupRequest=(_id:any,cb:any)=>{cb(null);return()=>{}};

export const readVisitIntakePage=async()=>({intakes:[],nextCursor:null});export const respondVisitIntake=cancelBooking;
