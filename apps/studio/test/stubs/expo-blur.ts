// Node render harness adapter, not native blur acceptance.
import{createElement,type ReactNode}from'react';
export const BlurView=({children,...props}:{children?:ReactNode;[k:string]:unknown})=>createElement('div',props,children);
