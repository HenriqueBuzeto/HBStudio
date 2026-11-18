import {NextRequest} from "next/server";
import {customerMutation,requestJson,requiredString,optionalString,respond} from "@/lib/parties-server";
import crypto from "node:crypto";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 return customerMutation(request,(await params).id,async(s,partyId,cid)=>{
  const b=await requestJson(request);
  const type=requiredString(b.equipmentType,"Tipo de equipamento",100),brand=requiredString(b.brand,"Marca",100),model=requiredString(b.model,"Modelo",140);
  const serial=optionalString(b.serialNumber,100),imei1=optionalString(b.imei1,40),imei2=optionalString(b.imei2,40),color=optionalString(b.color,80),notes=optionalString(b.notes,1000);
  const id=crypto.randomUUID();
  const rows=await s.db.query(
   'WITH created AS (INSERT INTO customer_equipments ("Id","TenantId","PartyId","EquipmentType","Brand","Model","SerialNumber","Imei1","Imei2","Color","Notes","CreatedAtUtc") VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11,now()) RETURNING "Id"),'+
   ' audited AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$2::uuid,$12::uuid,\'CustomerEquipment\',x."Id"::text,\'Created\',$13::uuid,$14,$15,jsonb_build_object(\'partyId\',$3,\'type\',$4,\'brand\',$5,\'model\',$6),now(),1 FROM created x RETURNING "Id") SELECT x."Id"::text AS id FROM created x JOIN audited a ON true',
   [id,s.tenantId,partyId,type,brand,model,serial,imei1,imei2,color,notes,s.branchId,s.userId,s.email,cid]);
  return respond({id:rows[0].id,created:true},cid,201);
 });
}
