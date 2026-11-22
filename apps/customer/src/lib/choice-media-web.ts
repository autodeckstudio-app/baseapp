import {Asset} from "expo-asset";
import {choiceMedia} from "./choice-media";
const uri=(v:import("react-native").ImageSourcePropType):string=>typeof v==="string"?v:typeof v==="number"?Asset.fromModule(v).uri:Array.isArray(v)?v[0]?.uri??"":v.uri??"";
export function choiceMediaURLs(id:string){const m=choiceMedia(id);return m?{...m,product:m.product?uri(m.product):null,logo:m.logo?uri(m.logo):null}:null;}
