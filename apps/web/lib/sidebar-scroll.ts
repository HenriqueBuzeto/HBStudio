// UI-only state, isolated by browser tab, tenant, operator and branch.
const memory = new Map<string,number>();
type StorageLike=Pick<Storage,"getItem"|"setItem">;
function storage():StorageLike|null{try{return typeof window==="undefined"?null:window.sessionStorage;}catch{return null;}}
export function sidebarStorageKey(tenant:string,user:string,branch?:string){return "hb:sidebar-scroll:v1:"+JSON.stringify([tenant,user,branch??""]);}
export function readSidebarPosition(key:string,store:StorageLike|null=storage()):number|null{
 if(memory.has(key))return memory.get(key)!;
 try{const raw=store?.getItem(key);if(raw==null||raw.trim()==="")return null;const value=Number(raw);if(Number.isFinite(value)&&value>=0){memory.set(key,value);return value;}}catch{}
 return null;
}
export function saveSidebarPosition(key:string,value:number,store:StorageLike|null=storage()){
 if(!Number.isFinite(value)||value<0)return;
 memory.set(key,value);
 try{store?.setItem(key,String(value));}catch{}
}
export function restoreSidebarPosition(nav:Pick<HTMLElement,"scrollTop"|"scrollHeight"|"clientHeight">,value:number){
 nav.scrollTop=Number.isFinite(value)?Math.max(0,Math.min(value,Math.max(0,nav.scrollHeight-nav.clientHeight))):0;
}
