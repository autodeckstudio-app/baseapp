/** Only first-party approved media records reach this player; no Instagram embeds or external browser handoff. */
export function safeVideoUrl(url:string):boolean {try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}
export const SERVICE_VIDEO_POLICY={autoPlay:false,muted:true,loop:false,preload:'none',contentFit:'contain',backgroundPlayback:false} as const;
