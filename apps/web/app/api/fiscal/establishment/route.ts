import {NextRequest,NextResponse} from "next/server";
import crypto from "node:crypto";
import {authorizeFleet,guardOrigin,FleetError} from "@/lib/fleet-session";
import {validateFiscalEstablishment} from "@/lib/fiscal-validation";

export async function POST(request:NextRequest){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  guardOrigin(request);
  const session=await authorizeFleet(request,"fiscal.settings.manage");
  if(Number(request.headers.get("content-length")||0)>10000)throw new FleetError(413,"PAYLOAD_TOO_LARGE","Cadastro fiscal muito extenso.");
  const v=validateFiscalEstablishment(await request.json().catch(()=>null));
  const [existing,history]=await Promise.all([
   session.db.query('SELECT "Id"::text AS id,"Cnpj" AS cnpj FROM fiscal_establishments WHERE "TenantId"=$1::uuid AND "BranchId"=$2::uuid LIMIT 2',[session.tenantId,session.branchId]),
   session.db.query('SELECT COUNT(*)::int AS count FROM fiscal_documents d JOIN fiscal_establishments e ON e."Id"=d."EstablishmentId" AND e."TenantId"=d."TenantId" WHERE d."TenantId"=$1::uuid AND e."BranchId"=$2::uuid',[session.tenantId,session.branchId])
  ]);
  if(existing.length>1)throw new FleetError(409,"ESTABLISHMENT_DUPLICATED","Mais de um estabelecimento nesta filial. Revisão fiscal necessária.");
  if(Number(history[0]?.count)>0)throw new FleetError(409,"FISCAL_HISTORY_LOCKED","Existem documentos fiscais. Alteração de emissor/número requer processo fiscal de migração auditável.");
  // Do not set IsNfceEnabled until real SEFAZ E2E homologation.
  const args=[
   session.tenantId,session.branchId,
   v.corporateName,v.tradeName,v.cnpj,v.stateRegistration,v.municipalRegistration,v.cnae,
   v.regime,v.street,v.number,v.complement||null,v.neighborhood,v.cityCodeIbge,v.cityName,
   v.state,v.postalCode,v.environment,v.nfceDefaultSeries,v.nfceNextNumber,
   session.userId,session.email,cid
  ];
  let rows;
  if(existing.length){
   rows=await session.db.query(
    'WITH updated AS (UPDATE fiscal_establishments SET "CorporateName"=$3,"TradeName"=$4,"Cnpj"=$5,"StateRegistration"=$6,"MunicipalRegistration"=$7,"Cnae"=$8,"Regime"=$9::int,"Street"=$10,"Number"=$11,"Complement"=$12,"Neighborhood"=$13,"CityCodeIbge"=$14,"CityName"=$15,"State"=$16,"PostalCode"=$17,"Environment"=$18::int,"NfceDefaultSeries"=$19::int,"NfceNextNumber"=$20::int,"QrVersion"=3,"IsNfceEnabled"=false,"IsActive"=true,"UpdatedAtUtc"=now() WHERE "TenantId"=$1::uuid AND "BranchId"=$2::uuid AND "Id"=$24::uuid AND NOT EXISTS(SELECT 1 FROM fiscal_documents d JOIN fiscal_establishments e ON e."Id"=d."EstablishmentId" AND e."TenantId"=d."TenantId" WHERE d."TenantId"=$1::uuid AND e."BranchId"=$2::uuid) RETURNING "Id"),' +
    ' audited AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$1::uuid,$2::uuid,\'FiscalEstablishment\',s."Id"::text,\'Updated\',$21::uuid,$22,$23,jsonb_build_object(\'cnpj\',$5,\'environment\',$18,\'isNfceEnabled\',false),now(),1 FROM updated s RETURNING "Id") SELECT s."Id"::text AS id FROM updated s CROSS JOIN audited',
    [...args,existing[0].id]
   );
  }else{
   rows=await session.db.query(
    'WITH created AS (INSERT INTO fiscal_establishments ("Id","TenantId","BranchId","CorporateName","TradeName","Cnpj","StateRegistration","MunicipalRegistration","Cnae","Regime","Street","Number","Complement","Neighborhood","CityCodeIbge","CityName","State","PostalCode","Environment","QrVersion","NfceDefaultSeries","NfceNextNumber","IsNfceEnabled","IsActive","CreatedAtUtc") VALUES(gen_random_uuid(),$1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,$9::int,$10,$11,$12,$13,$14,$15,$16,$17,$18::int,3,$19::int,$20::int,false,true,now()) RETURNING "Id"),' +
    ' audited AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$1::uuid,$2::uuid,\'FiscalEstablishment\',s."Id"::text,\'Created\',$21::uuid,$22,$23,jsonb_build_object(\'cnpj\',$5,\'environment\',$18,\'isNfceEnabled\',false),now(),1 FROM created s RETURNING "Id") SELECT s."Id"::text AS id FROM created s CROSS JOIN audited',
    args
   );
  }
  if(rows.length!==1)throw new FleetError(409,"FISCAL_CONFLICT","Cadastro fiscal não alterado. Atualize a tela.");
  return NextResponse.json({id:rows[0].id,configured:true,fiscalReady:false,message:"Estabelecimento cadastrado para homologação. Emissão bloqueada até validação externa da SEFAZ."},{status:200,headers:{"Cache-Control":"no-store","X-Correlation-Id":cid}});
 }catch(error){
  if(error instanceof FleetError)return NextResponse.json({code:error.code,error:error.message},{status:error.status,headers:{"X-Correlation-Id":cid}});
  console.error("[FISCAL]["+cid+"] Establishment:",error instanceof Error?error.name:"Unknown");
  return NextResponse.json({code:"ESTABLISHMENT_SAVE_UNAVAILABLE",error:"Não foi possível salvar o estabelecimento. Revise os dados e tente novamente."},{status:503,headers:{"X-Correlation-Id":cid}});
 }
}
