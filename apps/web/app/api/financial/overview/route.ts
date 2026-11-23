import { NextRequest,NextResponse } from "next/server";
import crypto from "crypto";
import {authorizeFleet,FleetError} from "@/lib/fleet-session";

const hdr=(cid:string)=>({"X-Correlation-Id":cid,"Cache-Control":"no-store"});
export async function GET(request:NextRequest){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  const ctx=await authorizeFleet(request,"finance.reports.view");
  const canPayables=ctx.permissions.has("finance.payables.view");
  const canReceivables=ctx.permissions.has("finance.receivables.view");
  const [journals,payables,receivables]=await Promise.all([
   ctx.db.query(`SELECT e."Id"::text AS id,e."DocumentNumber" AS "documentNumber",
    e."Description" AS description,e."SourceType" AS "sourceType",
    e."CompetenceDateUtc" AS "competenceDate",
    e."TotalAmount"::float8 AS "recordedTotal",
    COALESCE(SUM(CASE WHEN l."Direction"=1 THEN l."Amount" ELSE 0 END),0)::float8 AS debits,
    COALESCE(SUM(CASE WHEN l."Direction"=2 THEN l."Amount" ELSE 0 END),0)::float8 AS credits,
    COUNT(l."Id")::int AS "lineCount"
    FROM financial_journal_entries e
    LEFT JOIN financial_journal_lines l ON l."FinancialJournalEntryId"=e."Id" AND l."TenantId"=e."TenantId"
    WHERE e."TenantId"=$1::uuid AND e."BranchId"=$2::uuid
    GROUP BY e."Id" ORDER BY e."CompetenceDateUtc" DESC LIMIT 150`,[ctx.tenantId,ctx.branchId]),
   canPayables?ctx.db.query(`SELECT p."Id"::text AS id,p."TitleNumber" AS "titleNumber",p."Description" AS description,
    p."DueDateUtc" AS "dueDate",p."OriginalAmount"::float8 AS "originalAmount",p."PaidAmount"::float8 AS "settledAmount",
    GREATEST(0,p."OriginalAmount"-p."PaidAmount")::float8 AS balance,p."Status" AS status,
    COALESCE(s."Name",'Fornecedor não identificado') AS party
    FROM accounts_payable p LEFT JOIN parties s ON s."Id"=p."SupplierPartyId" AND s."TenantId"=p."TenantId"
    WHERE p."TenantId"=$1::uuid AND p."BranchId"=$2::uuid
    ORDER BY p."DueDateUtc" DESC LIMIT 150`,[ctx.tenantId,ctx.branchId]):Promise.resolve([]),
   canReceivables?ctx.db.query(`SELECT r."Id"::text AS id,r."TitleNumber" AS "titleNumber",r."Description" AS description,
    r."DueDateUtc" AS "dueDate",r."OriginalAmount"::float8 AS "originalAmount",r."ReceivedAmount"::float8 AS "settledAmount",
    GREATEST(0,r."OriginalAmount"-r."ReceivedAmount")::float8 AS balance,r."Status" AS status,
    COALESCE(c."Name",'Cliente não identificado') AS party
    FROM accounts_receivable r LEFT JOIN parties c ON c."Id"=r."CustomerPartyId" AND c."TenantId"=r."TenantId"
    WHERE r."TenantId"=$1::uuid AND r."BranchId"=$2::uuid
    ORDER BY r."DueDateUtc" DESC LIMIT 150`,[ctx.tenantId,ctx.branchId]):Promise.resolve([])
  ]);
  const inconsistent=journals.filter((j:any)=>j.lineCount<2||
   Math.abs(Number(j.debits)-Number(j.credits))>0.009||
   Math.abs(Number(j.recordedTotal)-Number(j.debits))>0.009);
  return NextResponse.json({
    journals,payables,receivables,
    allowed:{payables:canPayables,receivables:canReceivables},
    journalIntegrity:{reviewed:journals.length,inconsistent:inconsistent.length,
     unbalancedEntryIds:inconsistent.map((j:any)=>j.id)},
    dreAvailable:false,
    note:"Este painel apresenta títulos e lançamentos reais; DRE gerencial exige plano de contas classificado e fechamento homologado."
  },{headers:hdr(cid)});
 }catch(e){
  if(e instanceof FleetError)return NextResponse.json({code:e.code,error:e.message},{status:e.status,headers:hdr(cid)});
  console.error("[Finance]["+cid+"] ledger overview unavailable:",e instanceof Error?e.name:"unknown");
  return NextResponse.json({code:"FINANCE_UNAVAILABLE",error:"Não foi possível consultar o financeiro no Neon."},{status:503,headers:hdr(cid)});
 }
}
