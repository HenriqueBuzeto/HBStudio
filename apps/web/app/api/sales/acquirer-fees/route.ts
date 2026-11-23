import {NextRequest,NextResponse} from "next/server";
import crypto from "node:crypto";
import {authorizeFleet,FleetError,uuid} from "@/lib/fleet-session";
import {calculateAcquirerFee,type AcquirerRate,type FeeMethod} from "@/lib/acquirer-fees";

const head=(cid:string)=>({"Cache-Control":"no-store","X-Correlation-Id":cid});
export async function GET(request:NextRequest) {
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try{
  const ctx=await authorizeFleet(request,"sales.pos.use");
  if(!ctx.permissions.has("sales.cost.view")&&!ctx.permissions.has("finance.reports.view"))
   throw new FleetError(403,"FORBIDDEN","Visualização das taxas da adquirente exige acesso financeiro ou ao custo da venda.");
  const url=new URL(request.url);
  const method=url.searchParams.get("method");
  if(method!=="PIX"&&method!=="DEBIT"&&method!=="CREDIT")
   throw new FleetError(422,"INVALID_PAYMENT_METHOD","Forma de pagamento inválida.");
  const installments=Number(url.searchParams.get("installments")||1);
  if(!Number.isInteger(installments)||installments<1||installments>18||(method!=="CREDIT"&&installments!==1))
   throw new FleetError(422,"INVALID_INSTALLMENTS","Parcelamento inválido.");
  const amountCents=Number(url.searchParams.get("grossCents"));
  if(!Number.isSafeInteger(amountCents)||amountCents<=0||amountCents>100_000_000_000)
   throw new FleetError(422,"INVALID_GROSS","Valor bruto inválido.");
  const profileId=url.searchParams.get("profileId");
  if(profileId)uuid(profileId,"Maquininha");
  const profiles=await ctx.db.query(
   `SELECT p."Id"::text AS id,p."Name" AS name,p."Provider" AS provider,p."CurrentVersion" AS version
    FROM payment_acquirer_profiles p
    WHERE p."TenantId"=$1::uuid AND p."BranchId"=$2::uuid AND p."IsActive"=true
      AND p."CurrentVersion">0 ORDER BY p."Name" LIMIT 50`,[ctx.tenantId,ctx.branchId]
  );
  const target=profileId?profiles.find((p:any)=>p.id===profileId):
   profiles.length===1?profiles[0]:null;
  if(!target)return NextResponse.json({configured:false,profiles,
    explanation:profiles.length>1?"Selecione uma maquininha para prever as taxas.":
     "Nenhuma tabela de taxas publicada nesta filial. Configure em Financeiro e Governança.",
    customerInterestCents:0,quote:null,checkoutEnabled:false},{headers:head(cid)});
  const rates=await ctx.db.query(
   `SELECT r."Id"::text AS id,r."Method" AS method,r."Installments" AS installments,
      r."MdrBps" AS "mdrBps",r."AnticipationBps" AS "anticipationBps",
      r."FixedFeeCents" AS "fixedFeeCents",r."SettlementDays" AS "settlementDays",
      r."SettlementMode" AS "settlementMode",r."Enabled" AS enabled,v."Version" AS version
     FROM payment_acquirer_rate_versions v
     JOIN payment_acquirer_rate_rules r ON r."RateVersionId"=v."Id"
       AND r."TenantId"=v."TenantId" AND r."BranchId"=v."BranchId"
     WHERE v."TenantId"=$1::uuid AND v."BranchId"=$2::uuid AND v."ProfileId"=$3::uuid
       AND v."Version"=$4::integer AND r."Method"=$5 AND r."Installments"=$6::integer
     LIMIT 1`,
   [ctx.tenantId,ctx.branchId,target.id,target.version,method,installments]
  );
  const rate=rates[0];
  if(!rate||rate.enabled!==true)return NextResponse.json({
    configured:false,profiles,selectedProfileId:target.id,customerInterestCents:0,
    explanation:"A modalidade ou parcela está desabilitada na tabela da operadora.",
    quote:null,checkoutEnabled:false
   },{headers:head(cid)});
  const quote=calculateAcquirerFee(amountCents,{
    method:rate.method as FeeMethod,installments:rate.installments,mdrBps:rate.mdrBps,
    anticipationBps:rate.anticipationBps,fixedFeeCents:rate.fixedFeeCents,
    settlementDays:rate.settlementDays,settlementMode:rate.settlementMode,enabled:true
  } as AcquirerRate);
  return NextResponse.json({configured:true,profiles,selectedProfileId:target.id,
    profileVersion:target.version,rateRuleId:rate.id,customerInterestCents:0,
    quote,checkoutEnabled:false,
    disclaimer:"Estimativa contratual. A adquirente poderá repassar valores diferentes; somente a conciliação confirma o líquido recebido."},
    {headers:head(cid)});
 }catch(e){
  if(e instanceof FleetError)return NextResponse.json({code:e.code,error:e.message},{status:e.status,headers:head(cid)});
  console.error("[AcquirerQuote]["+cid+"] failure:",e instanceof Error?e.name:"unknown");
  return NextResponse.json({code:"PAYMENT_FEE_PREVIEW_UNAVAILABLE",error:"Não foi possível consultar a previsão da maquininha."},{status:503,headers:head(cid)});
 }
}
