export const useAuth=()=>({status:'ready',customerDocId:'local-customer',customerDocResolution:'resolved',user:{uid:'local-preview',displayName:'AutoDeck'},claims:{tenantId:'automodz',role:'customer'}});
export const listenToMyNotifications=(_t:any,_u:any,cb:any)=>{cb([]);return()=>{}};
export const usePricingVehicle=()=>({category:'suv',vehicle:null});export const useVehiclePrices=()=>({});export const servicePriceText=(s:any)=>'₹'+(s.basePrice/100).toLocaleString('en-IN');
export const calculateServicePrice=async()=>{throw Error('No live pricing in local preview')};
export const useRouter=()=>({push:()=>{},back:()=>{},replace:()=>{},navigate:()=>{},canGoBack:()=>true});export const useSegments=()=>[];export const useFocusEffect=()=>{};export const usePathname=()=>'/catalogue';
