import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { authorizeFleet, FleetError, guardOrigin, uuid } from "@/lib/fleet-session";

function errorResponse(err:unknown,cid:string){
 if(err instanceof FleetError)return NextResponse.json({code:err.code,error:err.message},{status:err.status,headers:{"X-Correlation-Id":cid}});
 console.error("[PDV]["+cid+"] Read error:",err instanceof Error?err.name:"Unknown");
 return NextResponse.json({code:"SALES_HISTORY_UNAVAILABLE",error:"Histórico de vendas indisponível."},{status:503,headers:{"X-Correlation-Id":cid}});
}

export async function GET(request:NextRequest){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  const ctx=await authorizeFleet(request,"sales.pos.use");
  const sales=await ctx.db.query(
   'SELECT s."Id"::text AS id,s."SaleNumber" AS "saleNumber",s."CustomerPartyId"::text AS "customerPartyId",p."Name" AS "customerName",u."FullName" AS "sellerName",s."Status" AS status,s."PaymentStatus" AS "paymentStatus",s."FulfillmentStatus" AS "fulfillmentStatus",s."DiscountTotal"::float8 AS "discountTotal",s."ChargesTotal"::float8 AS "chargesTotal",s."CreatedAtUtc" AS "createdAtUtc",s."ConfirmedAtUtc" AS "confirmedAtUtc",s."CancelledAtUtc" AS "cancelledAtUtc",COALESCE((SELECT sum(i."Quantity"*i."UnitPrice"-i."Discount")::float8 FROM sale_items i WHERE i."SaleId"=s."Id" AND i."TenantId"=s."TenantId"),0) AS subtotal FROM sales s LEFT JOIN parties p ON p."Id"=s."CustomerPartyId" AND p."TenantId"=s."TenantId" LEFT JOIN users u ON u."Id"=s."SellerUserId" AND u."TenantId"=s."TenantId" WHERE s."TenantId"=$1::uuid AND s."BranchId"=$2::uuid ORDER BY s."CreatedAtUtc" DESC LIMIT 100',
   [ctx.tenantId,ctx.branchId]
  );
  const ids=sales.map((s:any)=>s.id);
  let items:any[]=[], payments:any[]=[], documents:any[]=[];
  if(ids.length){
   [items,payments,documents]=await Promise.all([
    ctx.db.query('SELECT i."SaleId"::text AS "saleId",i."HistoricalSkuCode" AS "skuCode",i."HistoricalDescription" AS description,i."Quantity"::float8 AS quantity,i."UnitPrice"::float8 AS "unitPrice",i."Discount"::float8 AS discount FROM sale_items i WHERE i."TenantId"=$1::uuid AND i."SaleId"=ANY($2::uuid[])',[ctx.tenantId,ids]),
    ctx.db.query('SELECT p."SaleId"::text AS "saleId",p."Method" AS method,p."Amount"::float8 AS amount,p."Installments" AS installments,p."Status" AS status,p."TransactionReference" AS reference FROM sale_payment_intents p WHERE p."TenantId"=$1::uuid AND p."SaleId"=ANY($2::uuid[])',[ctx.tenantId,ids]),
    ctx.db.query('SELECT d."SaleId"::text AS "saleId",d."Status" AS status,d."AccessKey" AS "accessKey",d."ProtocolNumber" AS protocol,d."QrCodeUrl" AS "qrCodeUrl",d."SefazStatusCode" AS "sefazStatus",d."Series" AS series,d."Number" AS number FROM fiscal_documents d WHERE d."TenantId"=$1::uuid AND d."SaleId"=ANY($2::uuid[])',[ctx.tenantId,ids])
   ]);
  }
  const formatted=sales.map((s:any)=>{
   const subtotal=Number(s.subtotal),discount=Number(s.discountTotal),charges=Number(s.chargesTotal);
   return {
    ...s,customerName:s.customerName||"Consumidor não identificado",
    sellerName:s.sellerName||"Responsável indisponível",subtotal,
    totalAmount:Math.max(0,Math.round((subtotal-discount+charges)*100)/100),
    items:items.filter(i=>i.saleId===s.id),
    payments:payments.filter(p=>p.saleId===s.id),
    fiscalDocuments:documents.filter(d=>d.saleId===s.id),
   };
  });
  return NextResponse.json({sales:formatted},{headers:{"Cache-Control":"no-store","X-Correlation-Id":cid}});
 }catch(e){return errorResponse(e,cid);}
}

// LEGAL HOLD: no transaction may be marked as paid, stocked-out or SEFAZ authorized
// until the checkout coordinator performs atomic stock/cash settlement and verifiable
// payment confirmation; fiscal authorization must use the canonical SEFAZ provider.
export async function POST(request:NextRequest){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  guardOrigin(request);
  const ctx=await authorizeFleet(request,"sales.create");
  if(!ctx.permissions.has("sales.pos.use"))throw new FleetError(403,"FORBIDDEN","Permissão de PDV necessária.");
  const raw=await request.text();if(raw.length>100000)throw new FleetError(413,"SIZE_LIMIT","Solicitação muito extensa.");
  let body:any;try{body=JSON.parse(raw);}catch{throw new FleetError(422,"INVALID_BODY","Dados inválidos.");}
  if(body&&body.mode==="INTERNAL_QA_CASH"){
   const key=uuid(body.requestId,"Operação");
   if(!body.data||typeof body.data!=="object"||Array.isArray(body.data))throw new FleetError(422,"INVALID_BODY","Dados inválidos.");
   try{
    const [row]=await ctx.db.query("SELECT public.internal_checkout_cash_v5($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::jsonb) result",[ctx.tenantId,ctx.branchId,ctx.userId,key,JSON.stringify(body.data)]);
    return NextResponse.json({result:row.result},{headers:{"X-Correlation-Id":cid,"Cache-Control":"no-store"}});
   }catch(e){
    const code=(e as {code?:string})?.code;
    if(code==="42501")throw new FleetError(403,"CHECKOUT_QA_ONLY","Operação restrita à homologação interna.");
    if(["22023","22P02","22003"].includes(code||""))throw new FleetError(422,"INVALID_CHECKOUT","Revise os dados e confirme o recebimento.");
    if(["23514","23505","23503","40001","40P01"].includes(code||""))throw new FleetError(409,"CHECKOUT_CONFLICT","Confira turno, preço, estoque e configuração financeira antes de repetir.");
    throw e;
   }
  }
  return NextResponse.json({
   code:"CHECKOUT_NOT_HOMOLOGATED",
   error:"A finalização ainda requer integração transacional de estoque, caixa e confirmação de pagamentos. Nenhuma venda, baixa ou NFC-e foi gerada. Você pode salvar um orçamento real.",
  },{status:409,headers:{"X-Correlation-Id":cid,"Cache-Control":"no-store"}});
 }catch(e){return errorResponse(e,cid);}
}
