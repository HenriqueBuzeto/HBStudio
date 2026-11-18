import {NextRequest,NextResponse} from "next/server";
import crypto from "node:crypto";
import {authorizeFleet,FleetError} from "@/lib/fleet-session";
import {isFiscalEncryptionConfigured} from "@/lib/fiscal-vault";

export async function GET(request:NextRequest){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  const session=await authorizeFleet(request,"fiscal.documents.view");
  const e=await session.db.query(
   'SELECT "Id"::text AS id,"CorporateName" AS "corporateName","TradeName" AS "tradeName","Cnpj" AS cnpj,"StateRegistration" AS "stateRegistration","MunicipalRegistration" AS "municipalRegistration","Cnae" AS cnae,"Regime" AS regime,"Street" AS street,"Number" AS number,"Complement" AS complement,"Neighborhood" AS neighborhood,"CityCodeIbge" AS "cityCodeIbge","CityName" AS "cityName","State" AS state,"PostalCode" AS "postalCode","Environment" AS environment,"NfceDefaultSeries" AS "nfceDefaultSeries","NfceNextNumber" AS "nfceNextNumber","IsNfceEnabled" AS "isNfceEnabled" FROM fiscal_establishments WHERE "TenantId"=$1::uuid AND "BranchId"=$2::uuid ORDER BY "CreatedAtUtc" DESC LIMIT 2',
   [session.tenantId,session.branchId]
  );
  if(!e.length)return NextResponse.json({
    configured:false,establishment:null,certificate:null,csc:null,
    stats:{totalIssued:0,totalDocuments:0},fiscalReady:false,
    reason:"ESTABLISHMENT_NOT_CONFIGURED",
    readiness:{establishment:false,certificateValidated:false,cscConfigured:false,transportVerified:false,sefazHomologated:false,vaultConfigured:isFiscalEncryptionConfigured()}
   },{headers:{"Cache-Control":"no-store","X-Correlation-Id":cid}});
  if(e.length!==1)throw new FleetError(409,"FISCAL_DUPLICATE","Cadastros fiscais duplicados para esta filial.");
  const est=e[0],id=String(est.id);
  const [certs,cscs,stats]=await Promise.all([
   session.db.query('SELECT "Id"::text AS id,"SubjectName" AS "subjectName","Thumbprint" AS thumbprint,"ValidFromUtc" AS "validFromUtc","ValidUntilUtc" AS "validUntilUtc","Cnpj" AS cnpj,"IsActive" AS "isActive","KeyIvBase64" AS format FROM fiscal_certificates WHERE "TenantId"=$1::uuid AND "EstablishmentId"=$2::uuid ORDER BY "CreatedAtUtc" DESC LIMIT 1',[session.tenantId,id]),
   session.db.query('SELECT "Id"::text AS id,"CscId" AS "cscId","CscTokenMasked" AS "cscTokenMasked","Environment" AS environment,"IsActive" AS "isActive",encode(substring("EncryptedCscToken" from 1 for 4),\'escape\') AS format FROM fiscal_cscs WHERE "TenantId"=$1::uuid AND "EstablishmentId"=$2::uuid AND "Environment"=$3::int ORDER BY "CreatedAtUtc" DESC LIMIT 1',[session.tenantId,id,est.environment]),
   session.db.query('SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE "Status"=4)::int AS issued FROM fiscal_documents d JOIN fiscal_establishments e ON e."Id"=d."EstablishmentId" AND e."TenantId"=d."TenantId" WHERE d."TenantId"=$1::uuid AND e."BranchId"=$2::uuid',[session.tenantId,session.branchId])
  ]);
  const cert=certs[0]??null,csc=cscs[0]??null;
  const certStored=!!cert&&cert.format==="HBF1:AES-256-GCM";
  const cscStored=!!csc&&csc.format==="HBF1";
  const safeCertificate=cert?{id:cert.id,subjectName:cert.subjectName,thumbprint:cert.thumbprint,validFromUtc:cert.validFromUtc,validUntilUtc:cert.validUntilUtc,storedSecurely:certStored,isActive:false,trustValidated:false}:null;
  const safeCsc=csc?{id:csc.id,cscId:csc.cscId,cscTokenMasked:csc.cscTokenMasked,environment:Number(csc.environment)===2?"Homologação":"Produção",storedSecurely:cscStored,isActive:!!csc.isActive&&cscStored,verifiedBySefaz:false}:null;
  return NextResponse.json({
   configured:true,establishment:{...est,regime:Number(est.regime),environment:Number(est.environment)},
   certificate:safeCertificate,csc:safeCsc,
   stats:{totalIssued:stats[0]?.issued??0,totalDocuments:stats[0]?.total??0},
   fiscalReady:false,reason:"SEFAZ_TRANSPORT_AND_ICP_VALIDATION_PENDING",
   readiness:{establishment:true,certificateValidated:false,cscConfigured:!!safeCsc?.isActive,transportVerified:false,sefazHomologated:false,vaultConfigured:isFiscalEncryptionConfigured()}
  },{headers:{"Cache-Control":"no-store","X-Correlation-Id":cid}});
 }catch(error){
  if(error instanceof FleetError)return NextResponse.json({code:error.code,error:error.message},{status:error.status,headers:{"X-Correlation-Id":cid}});
  console.error("[FISCAL]["+cid+"] Status:",error instanceof Error?error.name:"Unknown");
  return NextResponse.json({code:"FISCAL_STATUS_UNAVAILABLE",error:"Não foi possível verificar a situação fiscal. Nenhuma emissão foi habilitada."},{status:503,headers:{"X-Correlation-Id":cid}});
 }
}
