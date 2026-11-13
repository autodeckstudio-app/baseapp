/** Event coalescing for read-only foreground refresh. No polling runs in background. */
export function createForegroundRefresh({refresh,now=Date.now,minGapMs=1000}:{refresh:()=>void;now?:()=>number;minGapMs?:number}) {
  let focused=false,foreground=true,disposed=false,last=-Infinity;
  const request=()=>{if(disposed||!focused||!foreground)return;const at=now();if(at-last<minGapMs)return;last=at;refresh();};
  return {
    focus(){focused=true;request();},
    blur(){focused=false;},
    foreground(active:boolean){const resumed=!foreground&&active;foreground=active;if(resumed)request();},
    stale(){request();},
    dispose(){disposed=true;focused=false;},
  };
}

/** Refresh signed media before its one-hour server URL expires; filter content expiry separately. */
export const PUBLIC_READ_STALE_MS=5*60_000;
export const MEDIA_READ_STALE_MS=50*60_000;
export function nextContentBoundary(values:readonly(string|null|undefined)[],now=Date.now()):number|null {
  const future=values.map(v=>v?Date.parse(v):NaN).filter(t=>Number.isFinite(t)&&t>now);
  return future.length?Math.min(...future):null;
}
