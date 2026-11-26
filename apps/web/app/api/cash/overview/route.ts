import { NextRequest,NextResponse } from "next/server";
import crypto from "crypto";
import {authorizeFleet,guardOrigin,FleetError,uuid} from "@/lib/fleet-session";

function headers(cid:string){return {"Cache-Control":"no-store","X-Correlation-Id":cid};}
function failure(e:unknown,cid:string) {
 if(e instanceof FleetError) return NextResponse.json({code:e.code,error:e.message},{status:e.status,headers:headers(cid)});
 const raw=e instanceof Error?e.message:"";
 const code=raw.match(/CASH_[A-Z_]+/)?.[0];
 if(code) return NextResponse.json({code,error:code==="CASH_REGISTER_ALREADY_OPEN"?
  "Este caixa já possui um turno aberto. Atualize a página.":code==="CASH_IDEMPOTENCY_CONFLICT"?
  "A solicitação já foi utilizada com dados diferentes.":"A abertura foi recusada por uma regra de integridade."},
  {status:code==="CASH_REGISTER_ALREADY_OPEN"||code==="CASH_IDEMPOTENCY_CONFLICT"?409:422,headers:headers(cid)});
 if((e as {code?:string})?.code==="23505")return NextResponse.json({
  code:"CASH_REGISTER_ALREADY_OPEN",error:"Caixa já aberto. Atualize os dados."},{status:409,headers:headers(cid)});
 console.error("[Cash]["+cid+"] operation failed:",e instanceof Error?e.name:"unknown");
 return NextResponse.json({code:"CASH_UNAVAILABLE",error:"Operação de caixa indisponível."},{status:503,headers:headers(cid)});
}

export async function GET(request:NextRequest) {
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try {
  const ctx=await authorizeFleet(request,"cash.shift.view");
  const [registers,shifts]=await Promise.all([
   ctx.db.query(`SELECT r."Id"::text AS id,r."Code" AS code,r."Name" AS name,r."Status" AS status, (r."Status"=1 AND NOT EXISTS(SELECT 1 FROM cash_shifts x WHERE x."TenantId"=r."TenantId" AND x."BranchId"=r."BranchId" AND x."CashRegisterId"=r."Id" AND x."Status" IN(1,2,3,4))) AS available
    FROM cash_registers r WHERE r."TenantId"=$1::uuid AND r."BranchId"=$2::uuid
    ORDER BY r."Code"`,[ctx.tenantId,ctx.branchId]),
   ctx.db.query(`SELECT sh."Id"::text AS id,sh."CashRegisterId"::text AS "registerId",
     cr."Name" AS "registerName",sh."OperatorUserId"::text AS "operatorId",
     sh."Status" AS status,sh."OpeningFloat"::float8 AS "openingFloat",
     sh."CurrentBalance"::float8 AS "recordedBalance",
     sh."TotalCashIn"::float8 AS "recordedCashIn",
     sh."TotalCashOut"::float8 AS "recordedCashOut",
     sh."OpenedAtUtc" AS "openedAtUtc",sh."ClosedAtUtc" AS "closedAtUtc",
     COALESCE(m."movementNet",0)::float8 AS "movementNet",
     COALESCE(m."movementCount",0)::int AS "movementCount",
     CASE WHEN ABS(sh."CurrentBalance"-COALESCE(m."movementNet",0))>0.009 THEN true ELSE false END AS "reconciliationMismatch"
     FROM cash_shifts sh
     JOIN cash_registers cr ON cr."Id"=sh."CashRegisterId"
       AND cr."TenantId"=sh."TenantId" AND cr."BranchId"=sh."BranchId"
     LEFT JOIN LATERAL (
      SELECT SUM(CASE WHEN cm."Direction"=1 THEN cm."Amount" ELSE -cm."Amount" END) "movementNet",
        COUNT(*)::int "movementCount"
      FROM cash_movements cm
      WHERE cm."TenantId"=sh."TenantId" AND cm."BranchId"=sh."BranchId" AND cm."CashShiftId"=sh."Id"
     ) m ON true
     WHERE sh."TenantId"=$1::uuid AND sh."BranchId"=$2::uuid
     ORDER BY sh."OpenedAtUtc" DESC LIMIT 100`,[ctx.tenantId,ctx.branchId])
  ]);
  // Costs/finance are not returned. CurrentBalance is a recorded value, not a reconciled cash count.
  return NextResponse.json({registers,shifts,
   canOpen:ctx.permissions.has("cash.open"),
   canManageRegisters:ctx.permissions.has("cash.register.manage"),
   canViewMovements:ctx.permissions.has("cash.movement.view"),
   note:"Saldos registrados no Neon; divergências exigem conciliação."},
   {headers:headers(cid)});
 }catch(e){return failure(e,cid);}
}

export async function POST(request:NextRequest) {
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try {
  guardOrigin(request);
  const ctx=await authorizeFleet(request,"cash.open");
  if(!ctx.permissions.has("cash.shift.view"))throw new FleetError(403,"FORBIDDEN","Permissão de consulta dos turnos necessária.");
  const body=await request.json();
  if(!body||typeof body!=="object"||Array.isArray(body))throw new FleetError(422,"VALIDATION_ERROR","Dados de abertura inválidos.");
  const registerId=uuid(body.registerId,"Caixa");
  const requestKey=uuid(body.requestKey,"Chave da solicitação");
  const amount=Number(body.openingFloat);
  if(typeof body.openingFloat!=="number"||
   !Number.isFinite(amount)||amount<0||amount>1000000||
   Math.abs(Math.round(amount*100)-amount*100)>0.000001)
   throw new FleetError(422,"INVALID_AMOUNT","O fundo inicial precisa ser um valor em reais e centavos.");
  const rows=await ctx.db.query(
   'SELECT * FROM cash_enterprise_open_shift($1::uuid,$2::uuid,$3::uuid,$4::text,$5::uuid,$6::numeric,$7::uuid,$8::text)',
   [ctx.tenantId,ctx.branchId,ctx.userId,ctx.email,registerId,amount,requestKey,cid]
  );
  return NextResponse.json({shiftId:rows[0].shiftId,openingFloat:Number(rows[0].openingFloat),
    message:"Turno de caixa aberto e auditado."},{status:201,headers:headers(cid)});
 }catch(e){return failure(e,cid);}
}
