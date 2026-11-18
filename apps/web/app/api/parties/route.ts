import {NextRequest} from "next/server";
import crypto from "node:crypto";
import {FleetError,authorizeFleet,guardOrigin} from "@/lib/fleet-session";
import {respond,requiredString,optionalString,intValue,requestJson} from "@/lib/loyalty-server";

const error=(err:unknown,cid:string)=>{
 if(err instanceof FleetError)return respond({error:err.message,code:err.code},cid,err.status);
 const ex=err as {code?:string;name?:string};
 if(ex.code==="23505")return respond({code:"DUPLICATE_CUSTOMER",error:"Cliente já cadastrado com esse documento."},cid,409);
 console.error("[PARTIES]["+cid+"] "+(ex.name||"DB_ERROR")+" ("+(ex.code||"unknown")+")");
 return respond({code:"PARTIES_DATABASE_UNAVAILABLE",error:"Falha ao consultar ou salvar clientes no Neon."},cid,503);
};

export async function GET(request:NextRequest){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  const s=await authorizeFleet(request,"customers.view");
  const url=new URL(request.url),search=(url.searchParams.get("search")||"").trim();
  if(search.length>120)throw new FleetError(400,"INVALID_SEARCH","Busca muito longa.");
  const page=Math.min(10000,Math.max(1,Number(url.searchParams.get("page"))||1));
  const size=Math.min(100,Math.max(1,Number(url.searchParams.get("pageSize"))||20));
  const onlyCustomer=url.searchParams.get("onlyCustomers")==="true";
  const onlySupplier=url.searchParams.get("onlySuppliers")==="true";
  const canSensitive=s.permissions.has("customers.sensitive.view");
  const sql=
   'SELECT p."Id"::text AS id,p."Type" AS type,p."Name" AS name,p."TradeName" AS "tradeName",CASE WHEN $6::boolean THEN p."DocumentNumber" ELSE NULL END AS "documentNumber",p."StateRegistration" AS "stateRegistration",p."MunicipalRegistration" AS "municipalRegistration",p."BirthDate" AS "birthDate",p."IsActive" AS "isActive",p."Notes" AS notes,p."CreatedAtUtc" AS "createdAtUtc",'+
   ' (cp."Id" IS NOT NULL) AS "isCustomer",(sp."Id" IS NOT NULL) AS "isSupplier",'+
   ' COALESCE((SELECT jsonb_agg(jsonb_build_object(\'id\',c."Id",\'name\',c."Name",\'phone\',CASE WHEN $6 THEN c."Phone" ELSE NULL END,\'whatsApp\',CASE WHEN $6 THEN c."WhatsApp" ELSE NULL END,\'email\',CASE WHEN $6 THEN c."Email" ELSE NULL END,\'isPrimary\',c."IsPrimary") ORDER BY c."CreatedAtUtc") FROM party_contacts c WHERE c."PartyId"=p."Id" AND c."TenantId"=p."TenantId"),\'[]\'::jsonb) AS contacts,'+
   ' COALESCE((SELECT jsonb_agg(jsonb_build_object(\'id\',a."Id",\'street\',CASE WHEN $6 THEN a."Street" ELSE NULL END,\'number\',CASE WHEN $6 THEN a."Number" ELSE NULL END,\'complement\',CASE WHEN $6 THEN a."Complement" ELSE NULL END,\'neighborhood\',CASE WHEN $6 THEN a."Neighborhood" ELSE NULL END,\'city\',a."City",\'state\',a."State",\'postalCode\',CASE WHEN $6 THEN a."PostalCode" ELSE NULL END,\'isPrimary\',a."IsPrimary") ORDER BY a."CreatedAtUtc") FROM party_addresses a WHERE a."PartyId"=p."Id" AND a."TenantId"=p."TenantId"),\'[]\'::jsonb) AS addresses,'+
   ' COALESCE((SELECT jsonb_agg(jsonb_build_object(\'id\',e."Id",\'equipmentType\',e."EquipmentType",\'brand\',e."Brand",\'model\',e."Model",\'color\',e."Color",\'imei1\',CASE WHEN $6 THEN e."Imei1" ELSE NULL END,\'notes\',e."Notes") ORDER BY e."CreatedAtUtc") FROM customer_equipments e WHERE e."PartyId"=p."Id" AND e."TenantId"=p."TenantId"),\'[]\'::jsonb) AS equipments,'+
   ' COALESCE((SELECT jsonb_agg(jsonb_build_object(\'id\',cs."Id",\'channel\',cs."Channel",\'purpose\',cs."Purpose",\'isOptIn\',cs."IsOptIn",\'origin\',cs."Origin",\'eventDateUtc\',cs."EventDateUtc") ORDER BY cs."EventDateUtc" DESC) FROM party_consent_records cs WHERE cs."PartyId"=p."Id" AND cs."TenantId"=p."TenantId"),\'[]\'::jsonb) AS consents,'+
   ' CASE WHEN la."Id" IS NULL THEN NULL ELSE jsonb_build_object(\'pointsBalance\',la."PointsBalance",\'cashbackAvailable\',la."CashbackCentsAccrued"::numeric/100,\'lifetimeValue\',la."EligibleSpendCents"::numeric/100,\'ordersCount\',la."PurchasesCount",\'repairsCount\',cp."CompletedRepairsCount",\'tier\',CASE WHEN la."LifetimeEarned">=lp."DiamondAtPoints" THEN \'Diamante\' WHEN la."LifetimeEarned">=lp."GoldAtPoints" THEN \'Ouro\' WHEN la."LifetimeEarned">=lp."SilverAtPoints" THEN \'Prata\' ELSE \'Bronze\' END) END AS gamification '+
   ' FROM parties p LEFT JOIN customer_profiles cp ON cp."PartyId"=p."Id" AND cp."TenantId"=p."TenantId" LEFT JOIN supplier_profiles sp ON sp."PartyId"=p."Id" AND sp."TenantId"=p."TenantId" LEFT JOIN loyalty_accounts la ON la."TenantId"=p."TenantId" AND la."PartyId"=p."Id" LEFT JOIN loyalty_programs lp ON lp."TenantId"=p."TenantId" WHERE p."TenantId"=$1::uuid AND ($2::text=\'\' OR p."Name" ILIKE (\'%\'||$2||\'%\') OR ($6::boolean AND p."DocumentNumber" ILIKE (\'%\'||$2||\'%\'))) AND (NOT $3::boolean OR cp."Id" IS NOT NULL) AND (NOT $4::boolean OR sp."Id" IS NOT NULL) ORDER BY p."CreatedAtUtc" DESC LIMIT $5::int OFFSET $7::int';
  const result=await s.db.query(sql,[s.tenantId,search,onlyCustomer,onlySupplier,size,canSensitive,(page-1)*size]);
  return respond(result,cid);
 }catch(e){return error(e,cid);}
}

export async function POST(request:NextRequest){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  guardOrigin(request);
  const b=await requestJson(request),customer=b.enableCustomer===true,supplier=b.enableSupplier===true;
  if(!customer&&!supplier)throw new FleetError(400,"PROFILE_REQUIRED","Marque cliente e/ou fornecedor.");
  const s=await authorizeFleet(request,customer?"customers.create":"suppliers.create");
  if(supplier&&!s.permissions.has("suppliers.create"))throw new FleetError(403,"FORBIDDEN","Permissão de fornecedor necessária.");
  const type=intValue(b.type,"Tipo de pessoa",1,2);
  const name=requiredString(b.name,"Nome",200);
  const tradeName=optionalString(b.tradeName,200),notes=optionalString(b.notes,2000);
  const document=optionalString(b.documentNumber,24)?.replace(/\D/g,"")||null;
  if(document&&(document.length!==(type===1?11:14)))throw new FleetError(400,"DOCUMENT_INVALID",type===1?"CPF deve ter 11 dígitos.":"CNPJ deve ter 14 dígitos.");
  const stateReg=optionalString(b.stateRegistration,30),municipalReg=optionalString(b.municipalRegistration,30);
  const birth=b.birthDate?new Date(String(b.birthDate)):null;
  if(birth&&(!Number.isFinite(birth.getTime())||birth>new Date()))throw new FleetError(400,"INVALID_BIRTHDATE","Data de nascimento inválida.");
  const customerNotes=optionalString(b.customerNotes,1000),supplyCats=optionalString(b.supplyCategories,500),terms=optionalString(b.paymentTerms,500);
  const phone=optionalString(b.primaryPhone,40),email=optionalString(b.primaryEmail,180);
  const id=crypto.randomUUID();
  const rows=await s.db.query(
   'WITH created AS (INSERT INTO parties ("Id","TenantId","Type","Name","TradeName","DocumentNumber","StateRegistration","MunicipalRegistration","BirthDate","IsActive","Notes","CreatedAtUtc") VALUES ($1::uuid,$2::uuid,$3::int,$4,$5,$6,$7,$8,$9::timestamptz,true,$10,now()) RETURNING "Id"),'+
   ' customer AS (INSERT INTO customer_profiles ("Id","TenantId","PartyId","InternalNotes","TotalSalesValue","CompletedRepairsCount","CreatedAtUtc") SELECT gen_random_uuid(),$2::uuid,p."Id",$11,0,0,now() FROM created p WHERE $12::boolean RETURNING "Id"),'+
   ' supplier AS (INSERT INTO supplier_profiles ("Id","TenantId","PartyId","SupplyCategories","PaymentTerms","LeadTimeDays","CreatedAtUtc") SELECT gen_random_uuid(),$2::uuid,p."Id",$13,$14,0,now() FROM created p WHERE $15::boolean RETURNING "Id"),'+
   ' contact AS (INSERT INTO party_contacts ("Id","TenantId","PartyId","Name","Phone","Email","WhatsApp","IsPrimary","CreatedAtUtc") SELECT gen_random_uuid(),$2::uuid,p."Id",$4,$16,$17,$16,true,now() FROM created p WHERE $16 IS NOT NULL OR $17 IS NOT NULL RETURNING "Id"),'+
   ' audited AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$2::uuid,$18::uuid,\'Party\',p."Id"::text,\'Created\',$19::uuid,$20,$21,jsonb_build_object(\'customer\',$12,\'supplier\',$15,\'name\',$4),now(),1 FROM created p RETURNING "Id") SELECT p."Id"::text AS id FROM created p CROSS JOIN audited a',
   [id,s.tenantId,type,name,tradeName,document,stateReg,municipalReg,birth?.toISOString()||null,notes,customerNotes,customer,supplyCats,terms,supplier,phone,email,s.branchId,s.userId,s.email,cid]
  );
  return respond({id:rows[0].id,created:true},cid,201);
 }catch(e){return error(e,cid);}
}
