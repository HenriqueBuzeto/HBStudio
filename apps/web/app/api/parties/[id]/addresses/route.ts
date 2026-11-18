import {NextRequest} from "next/server";
import {FleetError} from "@/lib/fleet-session";
import {customerMutation,requestJson,requiredString,optionalString,respond} from "@/lib/parties-server";
import crypto from "node:crypto";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 return customerMutation(request,(await params).id,async(s,partyId,cid)=>{
  const b=await requestJson(request);
  const street=requiredString(b.street,"Logradouro",200),number=requiredString(b.number,"Número",30),neighborhood=requiredString(b.neighborhood,"Bairro",140),city=requiredString(b.city,"Cidade",120),state=requiredString(b.state,"UF",2).toUpperCase(),cep=requiredString(b.postalCode,"CEP",12).replace(/\D/g,"");
  if(!/^[A-Z]{2}$/.test(state)||!/^\d{8}$/.test(cep))throw new FleetError(400,"INVALID_ADDRESS","CEP deve ter oito dígitos e UF duas letras.");
  const complement=optionalString(b.complement,160),primary=b.isPrimary===true,id=crypto.randomUUID();
  const rows=await s.db.query(
   'WITH parent AS (SELECT "Id" FROM parties WHERE "TenantId"=$2::uuid AND "Id"=$3::uuid FOR UPDATE),'+
   ' demoted AS (UPDATE party_addresses SET "IsPrimary"=false WHERE "TenantId"=$2::uuid AND "PartyId"=$3::uuid AND $11::boolean RETURNING "Id"),'+
   ' created AS (INSERT INTO party_addresses ("Id","TenantId","PartyId","Street","Number","Complement","Neighborhood","City","State","PostalCode","IsPrimary","CreatedAtUtc") SELECT $1::uuid,$2::uuid,p."Id",$4,$5,$6,$7,$8,$9,$10,$11::boolean,now() FROM parent p RETURNING "Id"),'+
   ' audited AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$2::uuid,$12::uuid,\'PartyAddress\',x."Id"::text,\'Created\',$13::uuid,$14,$15,jsonb_build_object(\'partyId\',$3,\'city\',$8,\'state\',$9),now(),1 FROM created x RETURNING "Id") SELECT x."Id"::text AS id FROM created x JOIN audited a ON true',
   [id,s.tenantId,partyId,street,number,complement,neighborhood,city,state,cep,primary,s.branchId,s.userId,s.email,cid]);
  return respond({id:rows[0].id,created:true},cid,201);
 });
}
