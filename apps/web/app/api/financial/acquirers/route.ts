import {NextRequest,NextResponse} from "next/server";
import crypto from "node:crypto";
import {authorizeFleet,guardOrigin,FleetError,uuid,string} from "@/lib/fleet-session";
import {percentToBps,currencyToCentsStrict,calculateAcquirerFee,type AcquirerRate} from "@/lib/acquirer-fees";

const headers=(cid:string)=>({"Cache-Control":"no-store","X-Correlation-Id":cid});
const fail=(e:unknown,cid:string)=>{
 if(e instanceof FleetError)return NextResponse.json({code:e.code,error:e.message},{status:e.status,headers:headers(cid)});
 const pg=(e as {code?:string})?.code;
 if(pg==="23505")return NextResponse.json({code:"ACQUIRER_DUPLICATE",error:"Já existe uma configuração com este nome ou versão."},{status:409,headers:headers(cid)});
 if(pg==="23503")return NextResponse.json({code:"INVALID_REFERENCE",error:"Dados de empresa, filial ou usuário inválidos."},{status:422,headers:headers(cid)});
 console.error("[Acquirers]["+cid+"] backend error:",e instanceof Error?e.name:"unknown");
 return NextResponse.json({code:"ACQUIRER_UNAVAILABLE",error:"Não foi possível salvar ou consultar as taxas da operadora."},{status:503,headers:headers(cid)});
};
type Json=Record<string,unknown>;
function bodyObject(obj:unknown):Json{
 if(!obj||typeof obj!=="object"||Array.isArray(obj))throw new FleetError(422,"INVALID_BODY","Dados inválidos.");
 return obj as Json;
}
function rulesPayload(input:unknown):AcquirerRate[]{
 if(!Array.isArray(input)||input.length!==20)throw new FleetError(422,"RATE_GRID_INCOMPLETE","Informe Pix, débito e todas as 18 faixas de crédito.");
 const keys=new Set<string>();
 const output:AcquirerRate[]=input.map((value:unknown)=>{
  const r=bodyObject(value);
  const method=r.method;
  if(method!=="PIX"&&method!=="DEBIT"&&method!=="CREDIT")throw new FleetError(422,"INVALID_METHOD","Modalidade inválida.");
  const installments=Number(r.installments);
  if(!Number.isInteger(installments)||installments<1||installments>18||(method!=="CREDIT"&&installments!==1))
   throw new FleetError(422,"INVALID_INSTALLMENTS","Parcelamento inválido.");
  const key=method+"/"+installments;
  if(keys.has(key))throw new FleetError(422,"DUPLICATED_RATE","Faixa duplicada: "+key);
  keys.add(key);
  const days=Number(r.settlementDays);
  if(!Number.isInteger(days)||days<0||days>365)throw new FleetError(422,"INVALID_SETTLEMENT_DAYS","Prazo D+ inválido em "+key);
  if(r.settlementMode!=="SINGLE"&&r.settlementMode!=="MONTHLY")throw new FleetError(422,"INVALID_SETTLEMENT_MODE","Liquidação inválida.");
  if(r.settlementMode==="MONTHLY"&&method!=="CREDIT")throw new FleetError(422,"INVALID_SETTLEMENT_MODE","Somente crédito pode ser pago mensalmente.");
  if(typeof r.enabled!=="boolean")throw new FleetError(422,"INVALID_ENABLED","Habilitação da modalidade obrigatória.");
  try{
   const rate:AcquirerRate={method,installments,
    mdrBps:percentToBps(r.mdrPercent,"MDR"),
    anticipationBps:percentToBps(r.anticipationPercent,"Antecipação"),
    fixedFeeCents:currencyToCentsStrict(r.fixedFee,"Tarifa fixa"),
    settlementDays:days,settlementMode:r.settlementMode,enabled:r.enabled};
   if(rate.mdrBps+rate.anticipationBps>=10000)throw new RangeError("Taxas excessivas");
   // Reject a fee grid that exceeds the gross amount even for a R$ 100.00 example.
   if(rate.enabled)calculateAcquirerFee(10_000,rate);
   return rate;
  }catch{throw new FleetError(422,"INVALID_RATE","Taxas inválidas ou incompatíveis na modalidade "+key+".");}
 });
 if(!keys.has("PIX/1")||!keys.has("DEBIT/1")||Array.from({length:18},(_,i)=>"CREDIT/"+(i+1)).some(k=>!keys.has(k)))
  throw new FleetError(422,"RATE_GRID_INCOMPLETE","Tabela incompleta.");
 if(output.every(r=>!r.enabled))throw new FleetError(422,"NO_ACTIVE_RATE","Habilite ao menos uma modalidade.");
 return output;
}
export async function GET(request:NextRequest){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  const ctx=await authorizeFleet(request,"finance.reports.view");
  const [profiles,rules]=await Promise.all([
   ctx.db.query(`SELECT p."Id"::text AS id,p."Name" AS name,p."Provider" AS provider,
     p."IsActive" AS "isActive",p."CurrentVersion" AS version,
     p."CreatedAtUtc" AS "createdAt",p."UpdatedAtUtc" AS "updatedAt"
     FROM payment_acquirer_profiles p WHERE p."TenantId"=$1::uuid AND p."BranchId"=$2::uuid
     ORDER BY p."Name" LIMIT 100`,[ctx.tenantId,ctx.branchId]),
   ctx.db.query(`SELECT v."ProfileId"::text AS "profileId",v."Version" AS version,
     v."Id"::text AS "versionId",v."EffectiveAtUtc" AS "effectiveAt",v."Notes" AS notes,
     r."Method" AS method,r."Installments" AS installments,
     r."MdrBps" AS "mdrBps",r."AnticipationBps" AS "anticipationBps",
     r."FixedFeeCents" AS "fixedFeeCents",r."SettlementDays" AS "settlementDays",
     r."SettlementMode" AS "settlementMode",r."Enabled" AS enabled
    FROM payment_acquirer_rate_versions v
    JOIN payment_acquirer_profiles p ON p."Id"=v."ProfileId" AND p."TenantId"=v."TenantId"
      AND p."BranchId"=v."BranchId" AND p."CurrentVersion"=v."Version"
    JOIN payment_acquirer_rate_rules r ON r."RateVersionId"=v."Id" AND r."TenantId"=v."TenantId"
      AND r."BranchId"=v."BranchId"
    WHERE p."TenantId"=$1::uuid AND p."BranchId"=$2::uuid
    ORDER BY p."Name",r."Method",r."Installments"`,[ctx.tenantId,ctx.branchId])
  ]);
  return NextResponse.json({profiles,rules,canManage:ctx.permissions.has("finance.banks.manage"),
    note:"Taxas contratuais informadas pela empresa. Líquidos calculados são PREVISÕES, não repasses conciliados."},
    {headers:headers(cid)});
 }catch(e){return fail(e,cid);}
}
export async function POST(request:NextRequest){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  guardOrigin(request);
  const ctx=await authorizeFleet(request,"finance.banks.manage");
  const body=bodyObject(await request.json());
  const name=string(body.name,"Nome da maquininha",120);
  const provider=string(body.provider,"Adquirente ou PSP",120);
  const rows=await ctx.db.query(`
    WITH created AS (
      INSERT INTO payment_acquirer_profiles ("TenantId","BranchId","Name","Provider","CreatedByUserId")
      VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid)
      RETURNING "Id","Name"
    ), audited AS (
      INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action",
        "ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version")
      SELECT gen_random_uuid(),$1::uuid,$2::uuid,'PaymentAcquirerProfile',c."Id"::text,
       'Created', $5::uuid,$6,$7,jsonb_build_object('name',c."Name",'provider',$4),now(),1
      FROM created c RETURNING "Id"
    )
    SELECT c."Id"::text AS id FROM created c JOIN audited a ON true`,
   [ctx.tenantId,ctx.branchId,name,provider,ctx.userId,ctx.email,cid]);
  return NextResponse.json({id:rows[0].id,version:0},{status:201,headers:headers(cid)});
 }catch(e){return fail(e,cid);}
}
export async function PUT(request:NextRequest){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  guardOrigin(request);
  const ctx=await authorizeFleet(request,"finance.banks.manage");
  const body=bodyObject(await request.json());
  const profileId=uuid(body.profileId,"Maquininha");
  const expectedVersion=Number(body.expectedVersion);
  if(!Number.isInteger(expectedVersion)||expectedVersion<0||expectedVersion>1000000)
   throw new FleetError(422,"INVALID_VERSION","Versão inválida.");
  const notes=body.notes==null?"":String(body.notes).trim();
  if(notes.length>500)throw new FleetError(422,"INVALID_NOTES","Observações muito longas.");
  const rules=rulesPayload(body.rules);
  const rows=await ctx.db.query(`
    WITH advanced AS (
      UPDATE payment_acquirer_profiles p
      SET "CurrentVersion"=p."CurrentVersion"+1, "UpdatedAtUtc"=now()
      WHERE p."TenantId"=$1::uuid AND p."BranchId"=$2::uuid AND p."Id"=$3::uuid
        AND p."IsActive"=true AND p."CurrentVersion"=$4::integer
      RETURNING p."Id",p."CurrentVersion"
    ), new_version AS (
      INSERT INTO payment_acquirer_rate_versions
        ("TenantId","BranchId","ProfileId","Version","Notes","CreatedByUserId")
      SELECT $1::uuid,$2::uuid,a."Id",a."CurrentVersion",$5,$6::uuid
      FROM advanced a RETURNING "Id","Version"
    ), inserted AS (
      INSERT INTO payment_acquirer_rate_rules (
        "TenantId","BranchId","RateVersionId","Method","Installments",
        "MdrBps","AnticipationBps","FixedFeeCents","SettlementDays","SettlementMode","Enabled"
      )
      SELECT $1::uuid,$2::uuid,v."Id",
        x.method,x.installments,x.mdr,x.anticipation,x.fixed,x.days,x.mode,x.enabled
      FROM new_version v
      CROSS JOIN jsonb_to_recordset($7::jsonb) AS x(
        method varchar(12), installments integer,mdr integer,anticipation integer,
        fixed integer,days integer,mode varchar(8),enabled boolean
      ) RETURNING "Id"
    ), audited AS (
      INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId",
       "Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version")
      SELECT gen_random_uuid(),$1::uuid,$2::uuid,'PaymentAcquirerProfile',$3::text,
       'RatesPublished',$6::uuid,$8,$9,
       jsonb_build_object('version',v."Version",'rules',(SELECT count(*) FROM inserted),'notes',$5),
       now(),v."Version" FROM new_version v RETURNING "Id"
    )
    SELECT v."Version" AS version,(SELECT count(*)::integer FROM inserted) AS count
    FROM new_version v JOIN audited a ON true`,
   [ctx.tenantId,ctx.branchId,profileId,expectedVersion,notes,ctx.userId,
    JSON.stringify(rules.map(r=>({method:r.method,installments:r.installments,
      mdr:r.mdrBps,anticipation:r.anticipationBps,fixed:r.fixedFeeCents,
      days:r.settlementDays,mode:r.settlementMode,enabled:r.enabled}))),ctx.email,cid]
  );
  if(rows.length!==1)throw new FleetError(409,"ACQUIRER_VERSION_CONFLICT","A tabela foi atualizada por outra sessão ou não pertence a esta filial. Atualize a página.");
  if(Number(rows[0].count)!==20)throw new Error("Rate insert count mismatch");
  return NextResponse.json({profileId,version:rows[0].version,ratesPublished:20},
   {headers:headers(cid)});
 }catch(e){return fail(e,cid);}
}
