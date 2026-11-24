import {NextRequest,NextResponse} from "next/server";
import crypto from "node:crypto";
import {authorizeFleet,FleetError,guardOrigin,uuid} from "@/lib/fleet-session";
const hdr=(cid:string)=>({"Cache-Control":"no-store","X-Correlation-Id":cid});
const error=(e:unknown,cid:string)=>{
 if(e instanceof FleetError)return NextResponse.json({code:e.code,error:e.message},{status:e.status,headers:hdr(cid)});
 console.error("[TrainingPOS]["+cid+"] error:",e instanceof Error?e.name:"unknown");
 return NextResponse.json({code:"TRAINING_SALE_UNAVAILABLE",error:"Não foi possível registrar a simulação."},{status:503,headers:hdr(cid)});
};
const methods=["CASH","PIX","CREDIT","DEBIT"] as const;
type CartItem={skuId:string;quantity:number};
export async function GET(request:NextRequest){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  const ctx=await authorizeFleet(request,"sales.pos.use");
  const rows=await ctx.db.query(`SELECT t."Id"::text id,t."Number" number,t."Status" status,
     t."CreatedAtUtc" "createdAt",t."TotalCents"::text "totalCents",
     t."DiscountCents"::text "discountCents",t."PaymentMethod" "paymentMethod",
     t."Installments" installments,t."ItemsSnapshot" items,
     p."Name" customer,u."FullName" seller
    FROM pos_training_checkout_records t
    LEFT JOIN parties p ON p."TenantId"=t."TenantId" AND p."Id"=t."CustomerPartyId"
    JOIN users u ON u."TenantId"=t."TenantId" AND u."Id"=t."SellerUserId"
    WHERE t."TenantId"=$1::uuid AND t."BranchId"=$2::uuid
    ORDER BY t."CreatedAtUtc" DESC LIMIT 100`,[ctx.tenantId,ctx.branchId]);
  const count=await ctx.db.query(`SELECT COUNT(*)::integer n,
    COALESCE(SUM("TotalCents") FILTER(WHERE "Status"='SIMULATED'),0)::text "simulatedTotalCents"
    FROM pos_training_checkout_records WHERE "TenantId"=$1::uuid AND "BranchId"=$2::uuid`,
    [ctx.tenantId,ctx.branchId]);
  return NextResponse.json({sales:rows,simulationCount:count[0].n,
    simulatedTotalCents:count[0].simulatedTotalCents,
    warning:"SIMULAÇÃO. Não é faturamento, receita fiscal, recebimento bancário ou venda real."},
    {headers:hdr(cid)});
 }catch(e){return error(e,cid);}
}
export async function POST(request:NextRequest){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  guardOrigin(request);
  const ctx=await authorizeFleet(request,"sales.pos.use");
  const data=await request.json();
  if(!data||typeof data!=="object"||Array.isArray(data))throw new FleetError(422,"INVALID_BODY","Dados inválidos.");
  const requestKey=uuid(data.requestKey,"Chave de idempotência");
  const sellerId=uuid(data.sellerId,"Vendedor");
  const customerId=data.customerId==null?null:uuid(data.customerId,"Cliente");
  if(!Array.isArray(data.items)||data.items.length<1||data.items.length>100)
   throw new FleetError(422,"INVALID_CART","Informe de 1 a 100 itens.");
  const items:CartItem[]=data.items.map((item:unknown)=>{
   const i=item as Record<string,unknown>;
   if(!i||typeof i!=="object"||Array.isArray(i))throw new FleetError(422,"INVALID_ITEM","Item inválido.");
   const skuId=uuid(i.skuId,"SKU");const quantity=Number(i.quantity);
   if(!Number.isInteger(quantity)||quantity<1||quantity>100)throw new FleetError(422,"INVALID_ITEM","Quantidade inválida.");
   return {skuId,quantity};
  });
  if(new Set(items.map(i=>i.skuId)).size!==items.length)throw new FleetError(422,"DUPLICATE_ITEM","SKU duplicado.");
  const method=data.paymentMethod;
  if(!methods.includes(method))throw new FleetError(422,"INVALID_METHOD","Forma inválida.");
  const installments=Number(data.installments);
  if(!Number.isInteger(installments)||installments<1||installments>18||(method!=="CREDIT"&&installments!==1))
   throw new FleetError(422,"INVALID_INSTALLMENTS","Parcelas inválidas.");
  const discountCents=Number(data.discountCents);
  if(!Number.isSafeInteger(discountCents)||discountCents<0||discountCents>100_000_000)
   throw new FleetError(422,"INVALID_DISCOUNT","Desconto inválido.");
  if(discountCents>0&&!ctx.permissions.has("sales.discount.override"))
   throw new FleetError(403,"FORBIDDEN","Desconto exige autorização.");
  // Never interpret a simulated payment method as a transfer, capture, or receipt.
  const [seller,customer,skus]=await Promise.all([
   ctx.db.query('SELECT "Id" FROM users WHERE "TenantId"=$1::uuid AND "Id"=$2::uuid AND "IsActive"=true',
     [ctx.tenantId,sellerId]),
   customerId?ctx.db.query('SELECT "Id" FROM parties WHERE "TenantId"=$1::uuid AND "Id"=$2::uuid AND "IsActive"=true',
     [ctx.tenantId,customerId]):Promise.resolve([{Id:null}]),
   ctx.db.query('SELECT "Id"::text id,"SkuCode" sku,"VariantName" description,"DefaultPrice"::text price FROM product_skus WHERE "TenantId"=$1::uuid AND "IsActive"=true AND "Id"=ANY($2::uuid[])',
     [ctx.tenantId,items.map(i=>i.skuId)])
  ]);
  if(!seller.length||!customer.length||skus.length!==items.length)
   throw new FleetError(422,"INVALID_REFERENCE","Vendedor, cliente ou SKU não disponível nesta empresa.");
  const snapshot=items.map(item=>{
   const sku=skus.find((s:any)=>s.id===item.skuId);
   if(!sku)throw new FleetError(422,"SKU_NOT_FOUND","SKU não encontrado para simulação.");
   const unitCents=Math.round(Number(sku.price)*100);
   if(!Number.isSafeInteger(unitCents)||unitCents<=0)
    throw new FleetError(422,"PRICE_INVALID","SKU sem preço válido.");
   return {skuId:item.skuId,skuCode:sku.sku,description:sku.description,
     quantity:item.quantity,unitCents,lineCents:unitCents*item.quantity};
  });
  const subtotalCents=snapshot.reduce((sum,i)=>sum+i.lineCents,0);
  if(!Number.isSafeInteger(subtotalCents)||discountCents>=subtotalCents)
   throw new FleetError(422,"TOTAL_INVALID","Valor total inválido.");
  const canonical={sellerId,customerId,items,method,installments,discountCents};
  const hash=crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  const id=crypto.randomUUID();
  const number="SIM-"+id.toUpperCase();
  const rows=await ctx.db.query(`
    WITH created AS (
      INSERT INTO pos_training_checkout_records ("Id","TenantId","BranchId","CreatedByUserId",
       "CustomerPartyId","SellerUserId","RequestKey","Number","PaymentMethod","Installments",
       "ItemsSnapshot","SubtotalCents","DiscountCents","TotalCents","RequestHash")
      VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::uuid,$8,
        $9,$10::int,$11::jsonb,$12::bigint,$13::bigint,$14::bigint,$15)
      ON CONFLICT ("TenantId","BranchId","RequestKey") DO NOTHING
      RETURNING "Id","Number","RequestHash"
    ), audited AS (
      INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId",
       "Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version")
      SELECT gen_random_uuid(),$2::uuid,$3::uuid,'PosTrainingSale',c."Id"::text,
       'Simulated',$4::uuid,$16,$17,jsonb_build_object('simulation',true,'grossCents',$14,'fiscal',false),now(),1
      FROM created c RETURNING "Id"
    )
    SELECT c."Id"::text AS id,c."Number" AS number,c."RequestHash" AS hash,
      true AS created FROM created c JOIN audited a ON true
    UNION ALL
    SELECT t."Id"::text id,t."Number" number,t."RequestHash" hash,
      false AS created FROM pos_training_checkout_records t
    WHERE t."TenantId"=$2::uuid AND t."BranchId"=$3::uuid AND t."RequestKey"=$7::uuid
      AND NOT EXISTS (SELECT 1 FROM created)
    LIMIT 1`,
    [id,ctx.tenantId,ctx.branchId,ctx.userId,customerId,sellerId,requestKey,
     number,method,installments,JSON.stringify(snapshot),subtotalCents,
     discountCents,subtotalCents-discountCents,hash,ctx.email,cid]);
  if(rows[0]?.hash!==hash)throw new FleetError(409,"IDEMPOTENCY_MISMATCH","Esta chave já foi utilizada para outra simulação.");
  if(!rows[0])throw new FleetError(409,"TRAINING_CONFLICT","Não foi possível confirmar a simulação. Atualize e tente novamente.");
  return NextResponse.json({id:rows[0].id,number:rows[0].number,
    totalCents:subtotalCents-discountCents,created:rows[0].created,
    status:"SIMULATED",fiscal:"NOT_APPLICABLE_TRAINING",
    warning:"SIMULAÇÃO — nenhum pagamento recebido, estoque baixado, lançamento financeiro ou documento fiscal criado."},
    {status:rows[0].created?201:200,headers:hdr(cid)});
 }catch(e){return error(e,cid);}
}
