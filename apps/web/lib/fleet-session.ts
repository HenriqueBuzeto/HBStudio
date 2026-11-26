import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { getDb } from "@/lib/serverless-db";

export class FleetError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function uuid(v: unknown, label = "Identificador"): string {
  if (typeof v !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))
    throw new FleetError(400,"VALIDATION_ERROR",label+" inválido.");
  return v;
}
export function string(v:unknown,label:string,max=180): string {
  if(typeof v!=="string" || !v.trim() || v.trim().length>max)throw new FleetError(400,"VALIDATION_ERROR",label+" obrigatório.");
  return v.trim();
}
export function optional(v:unknown,max=1000):string|null {
  if(v===null||v===undefined||v==="")return null;
  if(typeof v!=="string"||v.length>max)throw new FleetError(400,"VALIDATION_ERROR","Texto inválido.");
  return v.trim()||null;
}
export function decimal(v:unknown,label:string,zeroAllowed=true,max=100000000):number {
  const n=Number(v);
  if(v===null||v===undefined||v===""||!Number.isFinite(n)||n<0||(!zeroAllowed&&n===0)||n>max)
    throw new FleetError(400,"VALIDATION_ERROR",label+" inválido.");
  return n;
}
export function enumValue(v:unknown,label:string,allowed:number[]):number{
  const n=Number(v);if(!Number.isInteger(n)||!allowed.includes(n))throw new FleetError(400,"VALIDATION_ERROR",label+" inválido.");return n;
}
export type FleetSession={db:ReturnType<typeof getDb>;tenantId:string;branchId:string;userId:string;email:string;permissions:Set<string>};
export async function authorizeFleet(request:NextRequest,permission:string|readonly string[]):Promise<FleetSession>{
  const token=request.cookies.get("hb_access_token")?.value;
  const secret=process.env.AUTH_SECRET||process.env.JWT_SECRET;
  if(!token)throw new FleetError(401,"UNAUTHORIZED","Sessão não encontrada.");
  if(!secret)throw new FleetError(503,"AUTH_CONFIG_ERROR","Autenticação indisponível.");
  let claims:jwt.JwtPayload;
  try {
    const v=jwt.verify(token,secret,{algorithms:["HS256"],issuer:"HBStudioErp",audience:"HBStudioErpClient"});
    if(typeof v==="string")throw new Error("invalid");
    claims=v;
  }catch{throw new FleetError(401,"UNAUTHORIZED","Sessão expirada ou inválida.");}
  const userId=uuid(claims.sub,"Usuário"),tenantId=uuid(claims.tenant_id,"Empresa"),branchId=uuid(claims.branch_id,"Filial");
  if(typeof claims.session_id!=="string"||!claims.session_id||claims.security_stamp===undefined)throw new FleetError(401,"UNAUTHORIZED","Sessão inválida.");
  const db=getDb();
  const users=await db.query(
    'SELECT u."Email",u."SecurityStamp",u."IsActive",' +
    ' EXISTS(SELECT 1 FROM revoked_sessions r WHERE r."SessionId"=$4) AS revoked,' +
    ' EXISTS(SELECT 1 FROM partners p WHERE p."TenantId"=u."TenantId" AND lower(p."Email")=lower(u."Email") AND p."Status"=1 AND p."IsErpAccessEnabled"=true) AS partner' +
    ' FROM users u WHERE u."Id"=$1::uuid AND u."TenantId"=$2::uuid AND u."DefaultBranchId"=$3::uuid LIMIT 1',
    [userId,tenantId,branchId,claims.session_id]
  );
  const user=users[0];
  if(!user||!user.IsActive||user.revoked||!user.partner||String(user.SecurityStamp)!==String(claims.security_stamp))throw new FleetError(401,"UNAUTHORIZED","Acesso não autorizado.");
  const perms=await db.query('SELECT DISTINCT rp."PermissionKey" AS key FROM user_roles ur JOIN role_permissions rp ON rp."RoleId"=ur."RoleId" AND rp."TenantId"=ur."TenantId" WHERE ur."TenantId"=$1::uuid AND ur."UserId"=$2::uuid',[tenantId,userId]);
  const permissions=new Set<string>(perms.map((r:any)=>String(r.key)));
  if(!(typeof permission==="string"?permissions.has(permission):permission.some(key=>permissions.has(key))))throw new FleetError(403,"FORBIDDEN",typeof permission==="string"?"Permissão "+permission+" necessária.":"Permissão necessária para esta consulta.");
  return {db,tenantId,branchId,userId,email:user.Email,permissions};
}
export function guardOrigin(request:NextRequest) {
  const origin=request.headers.get("origin");
  const host=request.headers.get("x-forwarded-host")||request.headers.get("host");
  if(request.headers.get("sec-fetch-site")==="cross-site"||!origin||!host)throw new FleetError(403,"CSRF_BLOCKED","Origem não autorizada.");
  try{if(new URL(origin).host.toLowerCase()!==host.toLowerCase())throw new Error("host");}catch{throw new FleetError(403,"CSRF_BLOCKED","Origem não autorizada.");}
}
