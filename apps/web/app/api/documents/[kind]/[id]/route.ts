import {NextRequest,NextResponse} from "next/server";
import crypto from "node:crypto";
import {authorizeFleet,FleetError,uuid} from "@/lib/fleet-session";

/** A document preview is a view of a persisted, scoped record, not fiscal authorization. */
type Context={params:Promise<{kind:string;id:string}>};
const headers=(cid:string)=>({"Cache-Control":"no-store","X-Correlation-Id":cid});
export async function GET(request:NextRequest,context:Context){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  const {kind,id}=await context.params;
  if(!["quote","service","contract","sale"].includes(kind))
   throw new FleetError(404,"DOCUMENT_NOT_FOUND","Tipo de documento não encontrado.");
  uuid(id,"Documento");
  const permission=kind==="quote"?"sales.pos.use":kind==="sale"?"sales.pos.use":"repairs.view";
  const ctx=await authorizeFleet(request,permission);
  if(kind==="sale")
   throw new FleetError(409,"SALE_RECEIPT_NOT_HOMOLOGATED",
    "Comprovantes de venda ficam bloqueados até a confirmação transacional e fiscal do checkout. Não é permitido imprimir pagamento ainda não confirmado.");
  const [issuer]=await ctx.db.query(
   `SELECT t."Name" AS "tenantName",b."Name" AS "branchName",
      e."CorporateName" AS "corporateName",e."TradeName" AS "tradeName",
      e."Cnpj" AS cnpj,e."Street" AS street,e."Number" AS streetNumber,
      e."CityName" AS city,e."State" AS state
    FROM tenants t JOIN branches b ON b."TenantId"=t."Id"
    LEFT JOIN LATERAL (
      SELECT "CorporateName","TradeName","Cnpj","Street","Number","CityName","State"
      FROM fiscal_establishments WHERE "TenantId"=t."Id" AND "BranchId"=b."Id"
      ORDER BY "CreatedAtUtc" DESC LIMIT 1
    ) e ON true
    WHERE t."Id"=$1::uuid AND b."Id"=$2::uuid`,
   [ctx.tenantId,ctx.branchId]
  );
  if(!issuer)throw new FleetError(404,"BRANCH_NOT_FOUND","Filial não encontrada.");
  const organization={
   name:String(issuer.tradeName||issuer.corporateName||issuer.tenantName),
   legalName:String(issuer.corporateName||issuer.tenantName),
   branch:String(issuer.branchName),cnpj:issuer.cnpj||null,
   address:[issuer.street,issuer.streetNumber,issuer.city,issuer.state].filter(Boolean).join(", ")
  };
  if(kind==="quote"){
   const rows=await ctx.db.query(
    `SELECT q."QuoteNumber" AS number,q."CreatedAtUtc" AS "createdAt",
       q."ValidUntilUtc" AS "validUntil",q."Status" AS status,
       q."PaymentTermsExpected" AS "paymentTerms",q."Notes" AS notes,
       q."DiscountTotal"::float8 AS discount,q."ShippingTotal"::float8 AS shipping,
       p."Name" AS customer
     FROM sales_quotes q
     LEFT JOIN parties p ON p."Id"=q."CustomerPartyId" AND p."TenantId"=q."TenantId"
     WHERE q."Id"=$3::uuid AND q."TenantId"=$1::uuid AND q."BranchId"=$2::uuid`,
    [ctx.tenantId,ctx.branchId,id]
   );
   if(!rows.length)throw new FleetError(404,"DOCUMENT_NOT_FOUND","Orçamento não encontrado nesta filial.");
   const items=await ctx.db.query(
    `SELECT "HistoricalSkuCode" AS sku,"HistoricalDescription" AS description,
       "Quantity"::float8 AS quantity,"UnitPrice"::float8 AS price,
       "Discount"::float8 AS discount
     FROM sales_quote_items
     WHERE "TenantId"=$1::uuid AND "SalesQuoteId"=$2::uuid ORDER BY "CreatedAtUtc"`,
    [ctx.tenantId,id]
   );
   const subtotal=items.reduce((n:number,i:any)=>n+Number(i.quantity)*Number(i.price)-Number(i.discount),0);
   return NextResponse.json({kind,documentType:"QUOTE",number:rows[0].number,
    issuedAt:rows[0].createdAt,organization,
    customer:rows[0].customer||"Consumidor não identificado",
    items:items.map((i:any)=>({sku:i.sku,description:i.description,quantity:Number(i.quantity),
      unitPrice:Number(i.price),discount:Number(i.discount)})),
    totals:{subtotal,discount:Number(rows[0].discount),shipping:Number(rows[0].shipping),
      total:Math.round((subtotal-Number(rows[0].discount)+Number(rows[0].shipping))*100)/100},
    paymentTerms:rows[0].paymentTerms,
    validUntil:rows[0].validUntil,
    notes:rows[0].notes,
    disclaimer:"ORÇAMENTO COMERCIAL. NÃO É CUPOM FISCAL. NÃO COMPROVA PAGAMENTO OU RESERVA DE ESTOQUE."},
    {headers:headers(cid)});
  }
  const rows=await ctx.db.query(
   `SELECT ro."OrderNumber" AS number,ro."CreatedAtUtc" AS "createdAt",
      ro."Status" AS status,ro."ReportedDefect" AS defect,
      ro."PhysicalConditionNotes" AS "condition",ro."DiagnosticNotes" AS diagnostic,
      ro."ResolutionNotes" AS resolution,ro."LegalWarrantyDays" AS "legalWarrantyDays",
      ro."AdditionalWarrantyDays" AS "additionalWarrantyDays",
      ro."TotalDiscount"::float8 AS discount,ro."FinalPrice"::float8 AS total,
      p."Name" AS customer,ce."Brand" AS brand,ce."Model" AS model,
      ce."EquipmentType" AS "equipmentType",ce."SerialNumber" AS serial
    FROM repair_orders ro
    JOIN parties p ON p."Id"=ro."CustomerId" AND p."TenantId"=ro."TenantId"
    JOIN customer_equipments ce ON ce."Id"=ro."CustomerEquipmentId" AND ce."TenantId"=ro."TenantId"
    WHERE ro."TenantId"=$1::uuid AND ro."BranchId"=$2::uuid AND ro."Id"=$3::uuid`,
    [ctx.tenantId,ctx.branchId,id]
  );
  if(!rows.length)throw new FleetError(404,"DOCUMENT_NOT_FOUND","OS não encontrada nesta filial.");
  const order=rows[0];
  const items=await ctx.db.query(
   `SELECT "ItemType" AS "itemType","Description" AS description,
      "Quantity"::float8 AS quantity,"UnitPrice"::float8 AS price
     FROM repair_estimate_items WHERE "TenantId"=$1::uuid AND "RepairOrderId"=$2::uuid
     ORDER BY "CreatedAtUtc"`,[ctx.tenantId,id]);
  const detail={
   equipment:[order.equipmentType,order.brand,order.model,order.serial].filter(Boolean).join(" • "),
   defect:order.defect,condition:order.condition,diagnostic:order.diagnostic,resolution:order.resolution,
   legalWarrantyDays:order.legalWarrantyDays,additionalWarrantyDays:order.additionalWarrantyDays
  };
  const documentType=kind==="contract"?"SERVICE_TERMS_DRAFT":"SERVICE_ORDER";
  return NextResponse.json({kind,documentType,
   number:order.number,issuedAt:order.createdAt,organization,
   customer:order.customer,detail,
   items:items.map((i:any)=>({description:i.description,
     quantity:Number(i.quantity),unitPrice:Number(i.price),discount:0,
     category:Number(i.itemType)===1?"Serviço":"Peça"})),
   totals:{subtotal:items.reduce((n:number,i:any)=>n+Number(i.quantity)*Number(i.price),0),
     discount:Number(order.discount),shipping:0,total:Number(order.total)},
   disclaimer:kind==="contract"?
    "MINUTA DE TERMO DE SERVIÇO. NÃO ASSINADA. CONDIÇÕES, GARANTIAS E CONSENTIMENTOS DEVEM SER REVISADOS E ACEITOS PELAS PARTES.":
    "ORDEM DE SERVIÇO / COMPROVANTE DE ATENDIMENTO. NÃO É DOCUMENTO FISCAL E NÃO COMPROVA PAGAMENTO."},
   {headers:headers(cid)});
 }catch(err){
  if(err instanceof FleetError)return NextResponse.json({code:err.code,error:err.message},
   {status:err.status,headers:headers(cid)});
  console.error("[Documents]["+cid+"] secure print:",err instanceof Error?err.name:"unknown");
  return NextResponse.json({code:"DOCUMENT_UNAVAILABLE",error:"Documento indisponível para consulta."},
   {status:503,headers:headers(cid)});
 }
}
