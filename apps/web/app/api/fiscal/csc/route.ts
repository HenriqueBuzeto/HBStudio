import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {authorizeFleet,guardOrigin,FleetError} from "@/lib/fleet-session";
import {encryptFiscal} from "@/lib/fiscal-vault";

export async function POST(request:NextRequest){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  guardOrigin(request);
  const session=await authorizeFleet(request,"fiscal.settings.manage");
  if(Number(request.headers.get("content-length")||0)>4096)throw new FleetError(413,"PAYLOAD_TOO_LARGE","Payload CSC excede o limite.");
  const value:unknown=await request.json().catch(()=>null);
  if(!value||typeof value!=="object"||Array.isArray(value))throw new FleetError(400,"INVALID_JSON","Dados CSC inválidos.");
  const b=value as Record<string,unknown>;
  const cscId=String(b.cscId??"").trim();
  const token=String(b.cscToken??"").trim();
  const environment=Number(b.environment);
  if(!/^\d{6}$/.test(cscId))throw new FleetError(400,"INVALID_CSC_ID","O ID CSC deve conter 6 dígitos.");
  if(!/^[a-zA-Z0-9]{16,36}$/.test(token))throw new FleetError(400,"INVALID_CSC_TOKEN","O CSC deve conter de 16 a 36 caracteres alfanuméricos.");
  if(environment!==1&&environment!==2)throw new FleetError(400,"INVALID_ENVIRONMENT","Ambiente inválido.");
  const ests=await session.db.query('SELECT e."Id"::text AS id FROM fiscal_establishments e WHERE e."TenantId"=$1::uuid AND e."BranchId"=$2::uuid AND e."IsActive"=true AND e."Environment"=$3::int LIMIT 1',[session.tenantId,session.branchId,environment]);
  if(ests.length!==1)throw new FleetError(409,"ESTABLISHMENT_NOT_READY","Cadastre primeiro o estabelecimento desta filial no mesmo ambiente.");
  const estId=String(ests[0].id);
  const encrypted=encryptFiscal(token,session.tenantId,estId,environment,"csc");
  const masked=token.slice(0,2)+"••••"+token.slice(-2);
  const id=crypto.randomUUID();
  // All mutations and audit are one PostgreSQL statement, committed atomically.
  const rows=await session.db.query(
   'WITH older AS (UPDATE fiscal_cscs SET "IsActive"=false WHERE "TenantId"=$1::uuid AND "EstablishmentId"=$2::uuid AND "Environment"=$3::int AND "IsActive"=true RETURNING "Id"),' +
   ' created AS (INSERT INTO fiscal_cscs ("Id","TenantId","EstablishmentId","CscId","EncryptedCscToken","CscTokenMasked","Environment","IsActive","CreatedAtUtc") VALUES($4::uuid,$1::uuid,$2::uuid,$5,$6::bytea,$7,$3::int,true,now()) RETURNING "Id"),' +
   ' audited AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$1::uuid,$8::uuid,\'FiscalCsc\',c."Id"::text,\'Registered\',$9::uuid,$10,$11,jsonb_build_object(\'cscId\',$5,\'environment\',$3,\'credentialFormat\',\'HBF1\'),now(),1 FROM created c RETURNING "Id") SELECT c."Id"::text AS id FROM created c CROSS JOIN audited',
   [session.tenantId,estId,environment,id,cscId,encrypted,masked,session.branchId,session.userId,session.email,cid]
  );
  if(rows.length!==1)throw new FleetError(409,"CSC_WRITE_CONFLICT","CSC não registrado.");
  return NextResponse.json({registered:true,cscId,environment,masked,verifiedBySefaz:false,message:"CSC protegido e armazenado. Ainda não foi verificado pela SEFAZ."},{status:201,headers:{"Cache-Control":"no-store","X-Correlation-Id":cid}});
 }catch(err){
  if(err instanceof FleetError)return NextResponse.json({code:err.code,error:err.message},{status:err.status,headers:{"X-Correlation-Id":cid}});
  console.error("[FISCAL]["+cid+"] CSC registration error:",err instanceof Error?err.name:"Unknown");
  return NextResponse.json({code:"CSC_WRITE_UNAVAILABLE",error:"Não foi possível registrar o CSC com segurança."},{status:503,headers:{"X-Correlation-Id":cid}});
 }
}
