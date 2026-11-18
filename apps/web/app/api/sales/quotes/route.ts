import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { authorizeFleet, FleetError, guardOrigin, uuid, string } from "@/lib/fleet-session";

const code=(err:unknown,cid:string)=>{
 if(err instanceof FleetError)return NextResponse.json({code:err.code,error:err.message},{status:err.status,headers:{"X-Correlation-Id":cid}});
 console.error("[PDV]["+cid+"] quote transaction:",err instanceof Error?err.name:"Unknown");
 return NextResponse.json({code:"QUOTE_DATABASE_ERROR",error:"Não foi possível salvar o orçamento. Nenhuma venda ou recebimento foi gerado."},{status:503,headers:{"X-Correlation-Id":cid}});
};
export async function GET(request:NextRequest){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  const ctx=await authorizeFleet(request,"sales.pos.use");
  const [quotes,items]=await Promise.all([
    ctx.db.query('SELECT q."Id"::text AS id,q."QuoteNumber" AS number,q."Status" AS status,q."CustomerPartyId"::text AS "customerId",p."Name" AS customer,q."SellerUserId"::text AS "sellerId",u."FullName" AS seller,q."ValidUntilUtc" AS "validUntil",q."PaymentTermsExpected" AS "paymentTerms",q."DiscountTotal"::float8 AS discount,q."ShippingTotal"::float8 AS shipping,q."CreatedAtUtc" AS "createdAt" FROM sales_quotes q LEFT JOIN parties p ON p."Id"=q."CustomerPartyId" AND p."TenantId"=q."TenantId" LEFT JOIN users u ON u."Id"=q."SellerUserId" AND u."TenantId"=q."TenantId" WHERE q."TenantId"=$1::uuid AND q."BranchId"=$2::uuid ORDER BY q."CreatedAtUtc" DESC LIMIT 75',[ctx.tenantId,ctx.branchId]),
    ctx.db.query('SELECT i."SalesQuoteId"::text AS "quoteId",i."HistoricalSkuCode" AS sku,i."HistoricalDescription" AS description,i."Quantity"::float8 AS quantity,i."UnitPrice"::float8 AS price FROM sales_quote_items i JOIN sales_quotes q ON q."Id"=i."SalesQuoteId" AND q."TenantId"=i."TenantId" AND q."BranchId"=$2::uuid WHERE i."TenantId"=$1::uuid ORDER BY i."CreatedAtUtc" DESC LIMIT 1500',[ctx.tenantId,ctx.branchId])
  ]);
  const rows=quotes.map((q:any)=>{const own=items.filter((i:any)=>i.quoteId===q.id);const subtotal=own.reduce((s:number,i:any)=>s+i.quantity*i.price,0);return {...q,items:own,subtotal,total:Math.round((subtotal-q.discount+q.shipping)*100)/100};});
  return NextResponse.json({quotes:rows},{headers:{"Cache-Control":"no-store","X-Correlation-Id":cid}});
 }catch(err){return code(err,cid);}
}
export async function POST(request:NextRequest){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  guardOrigin(request);
  const ctx=await authorizeFleet(request,"sales.create");
  if(!ctx.permissions.has("sales.pos.use"))throw new FleetError(403,"FORBIDDEN","Acesso ao PDV necessário.");
  if(Number(request.headers.get("content-length")||0)>20000)throw new FleetError(413,"PAYLOAD_TOO_LARGE","Orçamento excede o limite permitido.");
  const b=await request.json().catch(()=>null);
  if(!b||typeof b!=="object"||Array.isArray(b))throw new FleetError(400,"INVALID_JSON","Dados de orçamento inválidos.");
  const sellerId=uuid(b.sellerId,"Vendedor");
  const customerId=b.customerId?uuid(b.customerId,"Cliente"):null;
  const m=Number(b.method),installments=Number(b.installments);
  if(![1,2,3,4].includes(m)||!Number.isInteger(installments)||installments<1||installments>12||(m!==3&&installments!==1))throw new FleetError(400,"VALIDATION_ERROR","Pagamento/parcelas inválidos.");
  const discountCents=Number(b.discountCents??0);
  if(!Number.isSafeInteger(discountCents)||discountCents<0||discountCents>100000000)throw new FleetError(400,"VALIDATION_ERROR","Desconto inválido.");
  if(discountCents>0&&!ctx.permissions.has("sales.discount.override"))throw new FleetError(403,"FORBIDDEN","Desconto exige permissão sales.discount.override.");
  const items:Array<{id:string;quantity:number}>=b.items;
  if(!Array.isArray(items)||items.length===0||items.length>50)throw new FleetError(400,"VALIDATION_ERROR","Informe de 1 a 50 produtos.");
  const parsed=items.map(i=>({id:uuid(i?.id,"Produto"),quantity:Number(i?.quantity),expectedCents:Number(i?.expectedPriceCents)}));
  if(parsed.some(i=>!Number.isSafeInteger(i.quantity)||i.quantity<=0||i.quantity>100||!Number.isSafeInteger(i.expectedCents)||i.expectedCents<0)||new Set(parsed.map(i=>i.id)).size!==parsed.length)
    throw new FleetError(400,"VALIDATION_ERROR","Itens duplicados ou quantidades inválidas.");
  const paymentTerms=string(b.paymentTerms,"Condição de pagamento",100);
  const quoteNumber="ORC-"+new Date().getUTCFullYear()+"-"+crypto.randomUUID().slice(0,12).toUpperCase();
  const sql=
  'WITH request_items AS (SELECT j.id,j.quantity FROM jsonb_to_recordset($5::jsonb) j(id uuid,quantity integer,"expectedCents" integer)), '+
  'valid_items AS (SELECT r.id,r.quantity,s."SkuCode" AS sku,s."VariantName" AS description,s."DefaultPrice" AS price FROM request_items r JOIN product_skus s ON s."Id"=r.id AND s."TenantId"=$1::uuid AND s."IsActive"=true AND ROUND(s."DefaultPrice"*100)::int=r."expectedCents"), '+
  'totals AS (SELECT COUNT(*)::int AS qty,COALESCE(SUM(v.quantity*v.price),0)::numeric(18,2) AS subtotal FROM valid_items v), '+
  'created AS (INSERT INTO sales_quotes ("Id","TenantId","BranchId","QuoteNumber","CustomerPartyId","SellerUserId","Status","ValidUntilUtc","PaymentTermsExpected","Notes","DiscountTotal","ShippingTotal","CreatedAtUtc") SELECT gen_random_uuid(),$1::uuid,$2::uuid,$3,$4::uuid,$6::uuid,1,now()+interval \'7 days\',$7,\'Orçamento de balcão; não reserva estoque nem confirma pagamento.\',$8::numeric/100,0,now() FROM totals WHERE totals.qty=$9 AND totals.subtotal>=$8::numeric/100 AND EXISTS(SELECT 1 FROM users u WHERE u."Id"=$6::uuid AND u."TenantId"=$1::uuid AND u."IsActive"=true) AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM parties p WHERE p."Id"=$4::uuid AND p."TenantId"=$1::uuid AND p."IsActive"=true)) RETURNING "Id","QuoteNumber"), '+
  'lines AS (INSERT INTO sales_quote_items ("Id","TenantId","SalesQuoteId","ProductSkuId","HistoricalSkuCode","HistoricalDescription","Quantity","UnitPrice","Discount","CreatedAtUtc") SELECT gen_random_uuid(),$1::uuid,c."Id",v.id,v.sku,v.description,v.quantity,v.price,0,now() FROM created c CROSS JOIN valid_items v RETURNING "Id"), '+
  'audit AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$1::uuid,$2::uuid,\'SalesQuote\',c."Id"::text,\'Created\',$10::uuid,$11,$12,jsonb_build_object(\'quoteNumber\',c."QuoteNumber",\'items\',$9,\'installments\',$13),now(),1 FROM created c RETURNING "Id") '+
  'SELECT c."Id"::text AS id,c."QuoteNumber" AS number,(SELECT COUNT(*)::int FROM lines) AS "itemCount",(SELECT subtotal::float8 FROM totals) AS subtotal,(SELECT COUNT(*) FROM audit) AS audits FROM created c';
  const result=await ctx.db.query(sql,[ctx.tenantId,ctx.branchId,quoteNumber,customerId,JSON.stringify(parsed),sellerId,paymentTerms,discountCents,parsed.length,ctx.userId,ctx.email,cid,installments]);
  if(!result.length)throw new FleetError(409,"QUOTE_REFERENCE_INVALID","Cliente, vendedor, produto ou preço alterado durante o atendimento. Atualize o PDV antes de salvar.");
  return NextResponse.json({quote:result[0],message:"Orçamento gravado no Neon. Nenhum pagamento, baixa ou NFC-e foi realizado."},{status:201,headers:{"X-Correlation-Id":cid}});
 }catch(err){return code(err,cid);}
}
