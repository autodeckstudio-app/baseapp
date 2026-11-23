import {createContext} from 'react';
export const SafeAreaInsetsContext=createContext<{top:number;right:number;bottom:number;left:number}|null>(null);
export function useSafeAreaInsets(){return {top:0,right:0,bottom:0,left:0};}
