import {NextRequest,NextResponse} from "next/server";
import crypto from "node:crypto";
import {authorizeFleet,guardOrigin,FleetError,uuid} from "@/lib/fleet-session";

const header=(id:string)=>({"Cache-Control":"no-store","X-Correlation-Id":id});
function failure(error:unknown,id:string){
 if(error instanceof FleetError)return NextResponse.json({code:error.code,error:error.message},{status:error.status,headers:header(id)});
 const message=error instanceof Error?error.message:"";
 if(message.includes("TRAINING_IDEMPOTENCY_CONFLICT"))return NextResponse.json({code:"IDEMPOTENCY_CONFLICT",error:"A chave da simulação já pertence a um carrinho diferente."},{status:409,headers:header(id)});
 if(message.includes("TRAINING_INVALID_ITEMS")||message.includes("TRAINING_INVALID_REQUEST")||message.includes("TRAINING_INVALID_SCOPE"))
  return NextResponse.json({code:"INVALID_TRAINING",error:"Confira o cliente, vendedor, itens e descontos da simulação."},{status:422,headers:header(id)});
 console.error("[TrainingSales]["+id+"] "+(error instanceof Error?error.name:"Unknown"));
 return NextResponse.json({code:"TRAINING_UNAVAILABLE",error:"Simulação indisponível; nenhum pagamento real foi processado."},{status:503,headers:header(id)});
}
type SubmittedItem={id:string;quantity:number};
export async function GET(request:NextRequest){
 const correlation=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  const ctx=await authorizeFleet(request,"sales.pos.use");
  const rows=await ctx.db.query(`SELECT t."Id"::text AS id,t."TrainingNumber" AS number,
     t."PaymentMethod" AS method,t."Installments" AS installments,t."SubtotalCents"::text AS "subtotalCents",
     t."DiscountCents"::text AS "discountCents",t."TotalCents"::text AS "totalCents",
     t."Status" AS status,t."CreatedAtUtc" AS "createdAt",
     coalesce(p."Name",'Consumidor não identificado') AS customer,
     u."FullName" AS seller,
     coalesce(jsonb_agg(jsonb_build_object('sku',i."SkuCode",'description',i."Description",
        'quantity',i."Quantity",'priceCents',i."UnitPriceCents"::text))
        FILTER (WHERE i."Id" IS NOT NULL),'[]'::jsonb) AS items
    FROM pos_training_sales t
    LEFT JOIN parties p ON p."Id"=t."CustomerPartyId" AND p."TenantId"=t."TenantId"
    JOIN users u ON u."Id"=t."SellerUserId" AND u."TenantId"=t."TenantId"
    LEFT JOIN pos_training_sale_items i ON i."TrainingSaleId"=t."Id"
      AND i."TenantId"=t."TenantId" AND i."BranchId"=t."BranchId"
    WHERE t."TenantId"=$1::uuid AND t."BranchId"=$2::uuid
    GROUP BY t."Id",p."Id",u."Id" ORDER BY t."CreatedAtUtc" DESC LIMIT 100`,
    [ctx.tenantId,ctx.branchId]);
  return NextResponse.json({simulations:rows,
   summary:{count:rows.length,realRevenueCents:"0",realCashCents:"0",stockAffected:false},
   notice:"Registros de treinamento: não compõem faturamento, contabilidade, caixa ou estoque."},
   {headers:header(correlation)});
 }catch(e){return failure(e,correlation);}
}
export async function POST(request:NextRequest){
 const correlation=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  guardOrigin(request);
  const ctx=await authorizeFleet(request,"sales.create");
  if(!ctx.permissions.has("sales.pos.use"))
   throw new FleetError(403,"FORBIDDEN","Acesso ao PDV necessário.");
  const b=await request.json() as Record<string,unknown>;
  if(!b||typeof b!=="object"||Array.isArray(b))
   throw new FleetError(422,"INVALID_REQUEST","Dados inválidos.");
  const key=uuid(b.idempotencyKey,"Chave de idempotência");
  const seller=uuid(b.sellerId,"Vendedor");
  const customer=b.customerId==null||b.customerId===""?null:uuid(b.customerId,"Cliente");
  const method=Number(b.method),installments=Number(b.installments),discount=Number(b.discountCents);
  if(!Number.isInteger(method)||method<1||method>4||
    !Number.isInteger(installments)||installments<1||installments>18||
    (method!==3&&installments!==1)||!Number.isSafeInteger(discount)||discount<0||
    discount>100_000_000_000)
   throw new FleetError(422,"INVALID_PAYMENT_PREVIEW","Forma de pagamento, parcelas ou desconto inválidos.");
  if(discount>0&&!ctx.permissions.has("sales.discount.override"))
   throw new FleetError(403,"FORBIDDEN","Desconto exige permissão.");
  if(!Array.isArray(b.items)||b.items.length<1||b.items.length>50)
   throw new FleetError(422,"INVALID_ITEMS","Informe de 1 a 50 SKUs para a simulação.");
  const items:SubmittedItem[]=b.items.map((value:unknown)=>{
   if(!value||typeof value!=="object"||Array.isArray(value))
    throw new FleetError(422,"INVALID_ITEMS","Item inválido.");
   const x=value as Record<string,unknown>;
   const quantity=Number(x.quantity);
   if(!Number.isInteger(quantity)||quantity<1||quantity>100)
    throw new FleetError(422,"INVALID_ITEMS","Quantidade inválida.");
   return {id:uuid(x.id,"SKU"),quantity};
  });
  if(new Set(items.map(x=>x.id)).size!==items.length)
   throw new FleetError(422,"DUPLICATE_SKU","SKU duplicado no carrinho.");
  const canonical={customer,seller,method,installments,discount,items:[...items].sort((a,b)=>a.id.localeCompare(b.id))};
  const hash=crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  const [row]=await ctx.db.query(
   'SELECT pos_training_create($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::text,$8::integer,$9::integer,$10::bigint,$11::jsonb) AS result',
   [ctx.tenantId,ctx.branchId,ctx.userId,seller,customer,key,hash,method,installments,discount,JSON.stringify(items.map(item=>({id:item.id,qty:item.quantity})))]
  );
  if(!row?.result)throw new Error("Training transaction returned no ID");
  return NextResponse.json({simulation:row.result,
   warning:"SIMULAÇÃO — não é venda, recebimento, cupom fiscal ou documento autorizado pela SEFAZ."},
   {status:201,headers:header(correlation)});
 }catch(e){return failure(e,correlation);}
}
