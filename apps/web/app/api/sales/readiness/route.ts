import {NextRequest,NextResponse} from "next/server";
import crypto from "crypto";
import {authorizeFleet,FleetError} from "@/lib/fleet-session";

export async function GET(request:NextRequest){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 const headers={"Cache-Control":"no-store","X-Correlation-Id":cid};
 try {
  const ctx=await authorizeFleet(request,"sales.pos.use");
  const [result]=await ctx.db.query(`SELECT
   EXISTS(SELECT 1 FROM cash_shifts sh WHERE sh."TenantId"=$1::uuid
     AND sh."BranchId"=$2::uuid AND sh."OperatorUserId"=$3::uuid AND sh."Status"=1)
       AS "openCashShift",
   EXISTS(SELECT 1 FROM warehouses w WHERE w."TenantId"=$1::uuid
     AND w."BranchId"=$2::uuid AND w."IsActive"=true) AS "warehouseConfigured",
   EXISTS(SELECT 1 FROM stock_balances sb WHERE sb."TenantId"=$1::uuid
     AND sb."BranchId"=$2::uuid AND sb."OnHandQuantity"-sb."ReservedQuantity"-sb."BlockedQuantity">0)
       AS "stockAvailable",
   EXISTS(SELECT 1 FROM financial_accounts a WHERE a."TenantId"=$1::uuid
     AND a."Type"=1 AND a."IsActive"=true) AS "assetAccountAvailable",
   EXISTS(SELECT 1 FROM financial_accounts a WHERE a."TenantId"=$1::uuid
     AND a."Type"=4 AND a."IsActive"=true) AS "revenueAccountAvailable",
   EXISTS(SELECT 1 FROM financial_accounts a WHERE a."TenantId"=$1::uuid
     AND a."Type"=5 AND a."IsActive"=true) AS "expenseAccountAvailable"`,
   [ctx.tenantId,ctx.branchId,ctx.userId]);
  const checks=[
   {code:"CASH_OPEN",ready:result.openCashShift,label:"Turno do operador aberto",module:"/cash"},
   {code:"WAREHOUSE",ready:result.warehouseConfigured,label:"Depósito da filial cadastrado",module:"/inventory"},
   {code:"STOCK",ready:result.stockAvailable,label:"Estoque disponível na filial",module:"/inventory"},
   {code:"FINANCE_ASSET",ready:result.assetAccountAvailable,label:"Conta contábil de ativo",module:"/financial"},
   {code:"FINANCE_REVENUE",ready:result.revenueAccountAvailable,label:"Conta contábil de receita",module:"/financial"},
   {code:"FINANCE_COGS",ready:result.expenseAccountAvailable,label:"Conta contábil de custo",module:"/financial"},
  ];
  return NextResponse.json({
   checks,
   checkoutEnabled:false,
   checkoutBlocker:"A liquidação transacional de vendas, pagamentos, estoque e financeiro ainda não foi homologada.",
   fiscalIssuanceReady:false,
   fiscalBlocker:"Documento fiscal depende de integração oficial e autorização SEFAZ.",
   note:"A presença de contas e estoque é pré-requisito, mas não valida por si só o checkout, o PSP ou a emissão fiscal."
  },{headers});
 }catch(e){
  if(e instanceof FleetError)return NextResponse.json({code:e.code,error:e.message},{status:e.status,headers});
  console.error("[POS]["+cid+"] readiness unavailable:",e instanceof Error?e.name:"unknown");
  return NextResponse.json({code:"POS_READINESS_UNAVAILABLE",error:"Não foi possível verificar os pré-requisitos do PDV."},{status:503,headers});
 }
}
