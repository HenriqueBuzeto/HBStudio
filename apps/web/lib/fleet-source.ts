// Identity of the canonical HB Studio Neon branch, not a connection credential.
export const MAIN_NEON_BRANCH="br-soft-cloud-b6p3no2x";
export type FleetSource={environment:"production"|"preview"|"local";database:"main"|"isolated";branchName:string;writable:boolean};
export function fleetSource(neonBranch:unknown,environment:string|undefined,branchName:string,mainBranch=MAIN_NEON_BRANCH):FleetSource|null{
 if(typeof neonBranch!=="string"||!/^br-[a-z0-9-]+$/.test(neonBranch)||!branchName.trim())return null;
 const env=environment==="production"?"production":environment==="preview"?"preview":"local";
 const main=neonBranch===mainBranch;
 if(env==="production"&&!main)return null;
 return {environment:env,database:main?"main":"isolated",branchName,writable:env==="production"?main:!main};
}
export function validFleetOverview(value:unknown):boolean{
 if(!value||typeof value!=="object")return false;
 const v=value as Record<string,unknown>,s=v.source as Partial<FleetSource>|undefined;
 return ["vehicles","trips","maintenance","fuelings","partners"].every(k=>Array.isArray(v[k]))&&!!s&&["production","preview","local"].includes(s.environment||"")&&["main","isolated"].includes(s.database||"")&&typeof s.branchName==="string"&&!!s.branchName.trim()&&typeof s.writable==="boolean"&&!(s.environment==="production"&&s.database!=="main")&&!(s.environment!=="production"&&s.database==="main"&&s.writable);
}
