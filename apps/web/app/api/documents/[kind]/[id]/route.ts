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
  if(!["quote","training","training-sale","service","contract","sale"].includes(kind))
   throw new FleetError(404,"DOCUMENT_NOT_FOUND","Tipo de documento não encontrado.");
  uuid(id,"Documento");
  const permission=kind==="quote"||kind==="training"||kind==="training-sale"||kind==="sale"?"sales.pos.use":"repairs.view";
  const ctx=await authorizeFleet(request,permission);
  if(kind==="training-sale"){
    const [train]=await ctx.db.query(
      `SELECT t."Number" AS number,t."CreatedAtUtc" AS "createdAt",
       t."PaymentMethod" AS method,t."Installments" AS installments,
       t."TotalCents"::text AS total,t."SubtotalCents"::text AS subtotal,
       t."DiscountCents"::text AS discount,t."ItemsSnapshot" AS items,
       t."Status" AS status,p."Name" AS customer,
       t."VoidedAtUtc" AS "voidedAt",t."VoidReason" AS "voidReason",
       creator."FullName" AS "operator",seller."FullName" AS seller,voider."FullName" AS "voidedBy",
       t."VoidedByUserId"::text AS "voidedById",
       event."Id"::text AS "voidEventId",
       b."Name" AS branchName,ten."Name" AS tenantName,
       e."CorporateName" AS "corporateName",e."TradeName" AS "tradeName",
       e."Cnpj" AS cnpj,e."Street" AS street,e."Number" AS "streetNumber",
       e."CityName" AS city,e."State" AS state
      FROM pos_training_checkout_records t
      JOIN branches b ON b."Id"=t."BranchId" AND b."TenantId"=t."TenantId"
      JOIN tenants ten ON ten."Id"=t."TenantId"
      LEFT JOIN LATERAL (
        SELECT "CorporateName","TradeName","Cnpj","Street","Number","CityName","State"
        FROM fiscal_establishments WHERE "TenantId"=t."TenantId" AND "BranchId"=t."BranchId"
        ORDER BY "CreatedAtUtc" DESC LIMIT 1
      ) e ON true
      LEFT JOIN parties p ON p."Id"=t."CustomerPartyId" AND p."TenantId"=t."TenantId"
      JOIN users creator ON creator."Id"=t."CreatedByUserId" AND creator."TenantId"=t."TenantId"
      JOIN users seller ON seller."Id"=t."SellerUserId" AND seller."TenantId"=t."TenantId"
      LEFT JOIN users voider ON voider."Id"=t."VoidedByUserId" AND voider."TenantId"=t."TenantId"
      LEFT JOIN LATERAL (SELECT a."Id" FROM audit_events a WHERE a."TenantId"=t."TenantId" AND a."BranchId"=t."BranchId" AND a."EntityType"='PosTrainingSale' AND a."EntityId"=t."Id"::text AND a."Action"='Voided' ORDER BY a."CreatedAtUtc" DESC LIMIT 1) event ON true
      WHERE t."Id"=$3::uuid AND t."TenantId"=$1::uuid AND t."BranchId"=$2::uuid`,
      [ctx.tenantId,ctx.branchId,id]
    );
    if(!train)throw new FleetError(404,"DOCUMENT_NOT_FOUND","Simulação não encontrada nesta filial.");
    const items=Array.isArray(train.items)?train.items:[];
    return NextResponse.json({kind,documentType:"TRAINING_SALE",number:train.number,
      issuedAt:train.createdAt,organization:{
       name:[train.tradeName,train.corporateName,train.tenantName].find(v=>typeof v==="string"&&v.trim())||"Empresa não identificada",
       legalName:[train.corporateName,train.tenantName].find(v=>typeof v==="string"&&v.trim())||"",
       branch:train.branchName||"Filial não identificada",cnpj:train.cnpj||null,
       address:[train.street,train.streetNumber,train.city,train.state].filter(Boolean).join(", ")
      },
      customer:train.customer||"Consumidor não identificado",
      items:items.map((i:any)=>({sku:i.skuCode,description:i.description,
       quantity:i.quantity,unitPrice:i.unitCents/100,discount:0})),
      totals:{subtotal:Number(train.subtotal)/100,discount:Number(train.discount)/100,
       shipping:0,total:Number(train.total)/100},
      training:{status:train.status,operator:train.operator,seller:train.seller,
       paymentMethod:train.method,installments:Number(train.installments),
       cancellation:train.status==="VOIDED"?{at:train.voidedAt,by:train.voidedBy||train.voidedById,reason:train.voidReason,eventId:train.voidEventId}:null},
      disclaimer:"SIMULAÇÃO / TREINAMENTO — NÃO É DOCUMENTO FISCAL, NÃO É COMPROVANTE DE PAGAMENTO. NENHUM ESTOQUE, CAIXA, RECEITA OU FINANCEIRO FOI MOVIMENTADO."},
      {headers:headers(cid)});
  }

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
  if(kind==="sale"){
   const [gate]=await ctx.db.query("SELECT public.internal_checkout_qa_enabled_v5() enabled");
   if(!gate?.enabled)throw new FleetError(409,"SALE_RECEIPT_NOT_HOMOLOGATED","Comprovante comercial indisponível fora da homologação.");
   const [row]=await ctx.db.query(`SELECT s."SaleNumber" number,s."ConfirmedAtUtc" "issuedAt",s."Status" status,c.state,c.total::float8 total,c.tendered::float8 tendered,c.change_amount::float8 change,p."Name" customer,u."FullName" operator,o."OrderNumber" "orderNumber",c.cancelled_at "cancelledAt",a.payload->>'reason' reason,v."FullName" "cancelledBy" FROM internal_checkout_records_v5 c JOIN sales s ON s."Id"=c.sale_id AND s."TenantId"=c.tenant_id AND s."BranchId"=c.branch_id JOIN users u ON u."Id"=c.actor_id AND u."TenantId"=c.tenant_id LEFT JOIN parties p ON p."Id"=c.customer_id AND p."TenantId"=c.tenant_id LEFT JOIN manufacturing_orders o ON o."Id"=c.order_id AND o."TenantId"=c.tenant_id AND o."BranchId"=c.branch_id LEFT JOIN LATERAL(SELECT x.payload,x.actor_id FROM internal_checkout_actions_v5 x WHERE x.tenant_id=c.tenant_id AND x.branch_id=c.branch_id AND x.sale_id=c.sale_id AND x.action='CANCEL' LIMIT 1) a ON true LEFT JOIN users v ON v."Id"=a.actor_id AND v."TenantId"=c.tenant_id WHERE c.tenant_id=$1::uuid AND c.branch_id=$2::uuid AND c.sale_id=$3::uuid AND s."ConfirmedAtUtc" IS NOT NULL AND ((c.state='CANCELLED' AND s."Status"=6 AND s."PaymentStatus"=7) OR (c.state IN('REGISTERED','DELIVERED') AND s."Status" IN(4,5) AND s."PaymentStatus"=4))`,[ctx.tenantId,ctx.branchId,id]);
   if(!row)throw new FleetError(404,"DOCUMENT_NOT_FOUND","Venda interna não localizada ou não confirmada.");
   const items=await ctx.db.query(`SELECT "HistoricalSkuCode" sku,"HistoricalDescription" description,"Quantity"::float8 quantity,"UnitPrice"::float8 "unitPrice","Discount"::float8 discount FROM sale_items WHERE "TenantId"=$1::uuid AND "SaleId"=$2::uuid ORDER BY "CreatedAtUtc","Id"`,[ctx.tenantId,id]);
   return NextResponse.json({kind,documentType:"INTERNAL_QA_SALE",number:row.number,issuedAt:row.issuedAt,organization,customer:row.customer||"Consumidor não identificado",items,totals:{subtotal:row.total,discount:0,shipping:0,total:row.total},sale:{state:row.state,operator:row.operator,orderNumber:row.orderNumber,tendered:row.tendered,change:row.change,cancellation:row.state==="CANCELLED"?{at:row.cancelledAt,by:row.cancelledBy,reason:row.reason}:null},disclaimer:"COMPROVANTE INTERNO DE HOMOLOGAÇÃO — NÃO É DOCUMENTO FISCAL. NÃO VÁLIDO PARA OPERAÇÕES COMERCIAIS."},{headers:headers(cid)});
  }
  if(kind==="quote"||kind==="training"){
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
   return NextResponse.json({kind,documentType:kind==="training"?"TRAINING_PREVIEW":"QUOTE",number:rows[0].number,
    issuedAt:rows[0].createdAt,organization,
    customer:rows[0].customer||"Consumidor não identificado",
    items:items.map((i:any)=>({sku:i.sku,description:i.description,quantity:Number(i.quantity),
      unitPrice:Number(i.price),discount:Number(i.discount)})),
    totals:{subtotal,discount:Number(rows[0].discount),shipping:Number(rows[0].shipping),
      total:Math.round((subtotal-Number(rows[0].discount)+Number(rows[0].shipping))*100)/100},
    paymentTerms:rows[0].paymentTerms,
    validUntil:rows[0].validUntil,
    notes:rows[0].notes,
    disclaimer:kind==="training"?"SIMULAÇÃO DE IMPRESSÃO. NÃO É VENDA, NÃO COMPROVA PAGAMENTO, NENHUM ESTOQUE OU CAIXA FOI MOVIMENTADO.":"ORÇAMENTO COMERCIAL. NÃO É CUPOM FISCAL. NÃO COMPROVA PAGAMENTO OU RESERVA DE ESTOQUE."},
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
