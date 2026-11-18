import {NextRequest} from "next/server";
import {FleetError} from "@/lib/fleet-session";
import {loyaltyHandler,LOYALTY_MANAGE,respond,requestJson,requiredString,optionalString,intValue,optionalDate,boolField,uuidField} from "@/lib/loyalty-server";

export async function PUT(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 return loyaltyHandler(request,LOYALTY_MANAGE,async(s,cid)=>{
  const id=uuidField((await params).id,"Recompensa"),b=await requestJson(request);
  const kind=requiredString(b.kind,"Tipo de recompensa",16);
  if(!["GIFT","SERVICE","VOUCHER","DISCOUNT"].includes(kind))throw new FleetError(400,"INVALID_REWARD_KIND","Tipo de recompensa inválido.");
  const title=requiredString(b.title,"Nome",160);
  const desc=optionalString(b.description,1000),points=intValue(b.pointsCost,"Pontos necessários",1,100000000);
  const cents=intValue(b.valueCents??0,"Valor em centavos",0,100000000);
  if(["VOUCHER","DISCOUNT"].includes(kind)&&cents<=0)throw new FleetError(400,"INVALID_AMOUNT","Vale ou desconto sem valor.");
  const stock=b.stockAvailable==null||b.stockAvailable===""?null:intValue(b.stockAvailable,"Estoque promocional",0,1000000);
  const active=boolField(b.isActive,"Ativo");
  const start=optionalDate(b.startsAtUtc,"Início"),end=optionalDate(b.endsAtUtc,"Fim");
  if(start&&end&&new Date(start)>=new Date(end))throw new FleetError(400,"INVALID_PERIOD","Datas inválidas.");
  const expected=intValue(b.expectedVersion,"Versão",1,2147483647);
  const rows=await s.db.query(
   'WITH updated AS (UPDATE loyalty_rewards SET "Kind"=$3,"Title"=$4,"Description"=$5,"PointsCost"=$6::int,"ValueCents"=$7::bigint,"StockAvailable"=$8::int,"IsActive"=$9::boolean,"StartsAtUtc"=$10::timestamptz,"EndsAtUtc"=$11::timestamptz,"Version"="Version"+1,"UpdatedAtUtc"=now() WHERE "Id"=$1::uuid AND "TenantId"=$2::uuid AND "Version"=$12::bigint RETURNING "Id","Version"),'+
   ' audit AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$2::uuid,$13::uuid,\'LoyaltyReward\',x."Id"::text,\'Updated\',$14::uuid,$15,$16,jsonb_build_object(\'title\',$4,\'active\',$9,\'kind\',$3,\'points\',$6,\'stock\',$8),now(),1 FROM updated x RETURNING "Id") SELECT x."Id"::text AS id,x."Version" AS version FROM updated x JOIN audit a ON true',
   [id,s.tenantId,kind,title,desc,points,cents,stock,active,start,end,expected,s.branchId,s.userId,s.email,cid]
  );
  if(!rows.length)throw new FleetError(409,"LOYALTY_REWARD_CONFLICT","Recompensa alterada por outro operador ou indisponível. Recarregue.");
  return respond(rows[0],cid);
 },true);
}
