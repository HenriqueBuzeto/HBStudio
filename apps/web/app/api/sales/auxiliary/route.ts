import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { authorizeFleet, FleetError } from "@/lib/fleet-session";

function failure(error:unknown, correlationId:string){
  if(error instanceof FleetError)return NextResponse.json({code:error.code,error:error.message},{status:error.status,headers:{"X-Correlation-Id":correlationId}});
  console.error("[PDV]["+correlationId+"] Auxiliary load failure:",error instanceof Error?error.name:"Unknown");
  return NextResponse.json({code:"AUXILIARY_UNAVAILABLE",error:"Não foi possível consultar dados reais do PDV no Neon."},{status:503,headers:{"X-Correlation-Id":correlationId}});
}

export async function GET(request:NextRequest){
 const correlationId=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  const context=await authorizeFleet(request,"sales.pos.use");
  const [customers,sellers,products,repairs,cash]=await Promise.all([
    context.db.query('SELECT p."Id"::text AS id,p."Name" AS name,p."DocumentNumber" AS document FROM parties p WHERE p."TenantId"=$1::uuid AND p."IsActive"=true ORDER BY p."Name" LIMIT 300',[context.tenantId]),
    context.db.query('SELECT u."Id"::text AS id,u."FullName" AS name,u."JobTitle" AS "jobTitle" FROM users u WHERE u."TenantId"=$1::uuid AND u."IsActive"=true ORDER BY u."FullName"',[context.tenantId]),
    context.db.query('SELECT s."Id"::text AS id,s."SkuCode" AS "skuCode",s."VariantName" AS name,s."DefaultPrice"::float8 AS price,s."BarcodeEan" AS barcode,COALESCE(SUM(GREATEST(0,b."OnHandQuantity"-b."ReservedQuantity"-b."BlockedQuantity")),0)::float8 AS "availableQuantity" FROM product_skus s LEFT JOIN stock_balances b ON b."ProductSkuId"=s."Id" AND b."TenantId"=s."TenantId" AND b."BranchId"=$2::uuid WHERE s."TenantId"=$1::uuid AND s."IsActive"=true GROUP BY s."Id",s."SkuCode",s."VariantName",s."DefaultPrice",s."BarcodeEan" ORDER BY s."VariantName" LIMIT 300',[context.tenantId,context.branchId]),
    context.db.query('SELECT r."Id"::text AS id,r."OrderNumber" AS "orderNumber",r."ReportedDefect" AS defect,r."CustomerId"::text AS "customerId",r."FinalPrice"::float8 AS "finalPrice",r."Status" AS status FROM repair_orders r WHERE r."TenantId"=$1::uuid AND r."BranchId"=$2::uuid AND r."Status"=11 ORDER BY r."CreatedAtUtc" DESC LIMIT 100',[context.tenantId,context.branchId]),
    context.db.query('SELECT sh."Id"::text AS id,cr."Name" AS register,sh."OpenedAtUtc" AS "openedAt" FROM cash_shifts sh JOIN cash_registers cr ON cr."Id"=sh."CashRegisterId" AND cr."TenantId"=sh."TenantId" AND cr."BranchId"=sh."BranchId" WHERE sh."TenantId"=$1::uuid AND sh."BranchId"=$2::uuid AND sh."OperatorUserId"=$3::uuid AND sh."Status"=1 ORDER BY sh."OpenedAtUtc" DESC LIMIT 1',[context.tenantId,context.branchId,context.userId])
  ]);
  return NextResponse.json({
   customers:customers.map((p:any)=>({...p,document:context.permissions.has("customers.sensitive.view")?p.document:null,points:null})),
   sellers,products,repairs,cashShift:cash[0]||null,
   fiscalReady:false,
   capabilities:{saveQuote:context.permissions.has("sales.create"),discountOverride:context.permissions.has("sales.discount.override"),cancel:context.permissions.has("sales.cancel"),fiscalIssue:false,checkout:false}
  },{headers:{"X-Correlation-Id":correlationId,"Cache-Control":"no-store"}});
 }catch(error){return failure(error,correlationId);}
}
