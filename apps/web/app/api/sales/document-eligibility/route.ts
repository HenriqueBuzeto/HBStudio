import {NextRequest,NextResponse} from "next/server";
import crypto from "node:crypto";
import {authorizeFleet,FleetError,uuid} from "@/lib/fleet-session";

/**
 * UI-only preflight, NOT an authorization to omit tax documentation.
 * The eventual checkout coordinator MUST re-evaluate the same predicate in
 * the authenticated settlement transaction and create immutable audit records.
 */
export async function GET(request:NextRequest){
 const correlationId=request.headers.get("x-correlation-id")||crypto.randomUUID();
 const headers={"Cache-Control":"no-store","X-Correlation-Id":correlationId};
 try{
  const ctx=await authorizeFleet(request,"sales.pos.use");
  const search=new URL(request.url).searchParams;
  const requestedCustomerId=search.get("customerId");
  if(requestedCustomerId)uuid(requestedCustomerId,"Cliente");
  // Customer is required for verified PF eligibility. Anonymous purchasers
  // are NOT assumed to be exempt merely because a CPF field is blank.
  if(!requestedCustomerId)return NextResponse.json({
    eligible:false,documentMode:"FISCAL",reason:"IDENTIFIED_PF_REQUIRED",
    explanation:"Identifique um cliente pessoa física para avaliar uma dispensa fiscal legalmente aplicável.",
    checkoutEnabled:false
  },{headers});
  const customer=await ctx.db.query(
    'SELECT "DocumentNumber" AS document,"Type" AS type,"IsActive" AS active FROM parties '+
    'WHERE "TenantId"=$1::uuid AND "Id"=$2::uuid LIMIT 1',
    [ctx.tenantId,requestedCustomerId]
  );
  const document=String(customer[0]?.document||"").replace(/\D/g,"");
  if(customer.length!==1||!customer[0].active||document.length!==11)return NextResponse.json({
    eligible:false,documentMode:"FISCAL",reason:"BUYER_NOT_VERIFIED_PF",
    explanation:"A operação exige cliente pessoa física identificado; cliente CNPJ e documento ausente não autorizam comprovante interno.",
    checkoutEnabled:false
  },{headers});
  const issuer=await ctx.db.query(
    'SELECT "Id"::text AS id,"Regime" AS regime,"State" AS state,"IsActive" AS active '+
    'FROM fiscal_establishments WHERE "TenantId"=$1::uuid AND "BranchId"=$2::uuid LIMIT 2',
    [ctx.tenantId,ctx.branchId]
  );
  if(issuer.length!==1||!issuer[0].active||Number(issuer[0].regime)!==4||issuer[0].state!=="SP"){
    return NextResponse.json({
      eligible:false,documentMode:"FISCAL",reason:"ISSUER_NOT_APPROVED_MEI",
      explanation:"O estabelecimento não está cadastrado como MEI (CRT 4) em SP, ou o cadastro fiscal está incompleto.",
      checkoutEnabled:false
    },{headers});
  }
  const policies=await ctx.db.query(
    'SELECT "Id"::text AS id,"ApprovalReference" AS reference '+
    'FROM fiscal_receipt_exemption_policies WHERE "TenantId"=$1::uuid AND "BranchId"=$2::uuid '+
    'AND "FiscalEstablishmentId"=$3::uuid AND "Regime"=4 AND "BuyerType"=\'PF\' '+
    'AND "OperationType"=\'LOCAL_GOODS\' AND "IsActive"=true '+
    'AND "ApprovedAtUtc" IS NOT NULL AND now()>="ValidFromUtc" AND now()<"ValidUntilUtc" '+
    'ORDER BY "ApprovedAtUtc" DESC LIMIT 1',
    [ctx.tenantId,ctx.branchId,issuer[0].id]
  );
  const eligible=policies.length===1;
  return NextResponse.json({
    eligible,documentMode:eligible?"INTERNAL_RECEIPT_ALLOWED":"FISCAL",
    reason:eligible?"EXEMPTION_POLICY_APPROVED":"COMPLIANCE_APPROVAL_REQUIRED",
    explanation:eligible?
     "Dispensa para operação local de mercadoria a PF sujeita à política fiscal aprovada. A elegibilidade será novamente verificada na conclusão da venda.":
     "Sem parecer fiscal vigente e aprovado para este estabelecimento. Mantenha a emissão fiscal.",
    checkoutEnabled:false,
    legalReviewReference:eligible?policies[0].reference:null
  },{headers});
 }catch(error){
  if(error instanceof FleetError)return NextResponse.json({code:error.code,error:error.message},{status:error.status,headers});
  console.error("[FiscalDocumentMode]["+correlationId+"] validation failed:",error instanceof Error?error.name:"unknown");
  return NextResponse.json({code:"FISCAL_POLICY_UNAVAILABLE",eligible:false,documentMode:"FISCAL",
    error:"Não foi possível validar a dispensa fiscal; mantenha o modo fiscal."},{status:503,headers});
 }
}
