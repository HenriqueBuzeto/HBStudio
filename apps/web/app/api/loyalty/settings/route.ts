import {NextRequest} from "next/server";
import {loyaltyRoute,PERMS,result,body,integer} from "@/lib/loyalty-server";
export async function GET(req:NextRequest){
 return loyaltyRoute(req,PERMS.view,async(ctx,cid)=>{
  const rows=await ctx.db.query('SELECT "Enabled" AS enabled,"EarnEveryCents" AS "earnEveryCents","PointsPerStep" AS "pointsPerStep","UpdatedAtUtc" AS "updatedAt" FROM loyalty_settings WHERE "TenantId"=$1::uuid LIMIT 1',[ctx.tenantId]);
  return result({configured:rows.length>0,settings:rows[0]??null,checkoutReady:false,cashbackSettlementReady:false},cid);
 });
}
export async function PUT(req:NextRequest){
 return loyaltyRoute(req,PERMS.manage,async(ctx,cid)=>{
  const data=await body(req);
  if(typeof data.enabled!=="boolean")return result({code:"VALIDATION_ERROR",error:"Habilitação deve ser informada."},cid,400);
  const earnEveryCents=integer(data.earnEveryCents,"Valor de geração de ponto em centavos",100,100000000);
  const pointsPerStep=integer(data.pointsPerStep,"Pontos por faixa",1,100);
  const r=await ctx.db.query(
   'WITH saved AS (INSERT INTO loyalty_settings("TenantId","Enabled","EarnEveryCents","PointsPerStep","EnabledSinceUtc") VALUES($1::uuid,$2::boolean,$3::int,$4::int,CASE WHEN $2::boolean THEN now() ELSE NULL END) ON CONFLICT("TenantId") DO UPDATE SET "Enabled"=EXCLUDED."Enabled","EarnEveryCents"=EXCLUDED."EarnEveryCents","PointsPerStep"=EXCLUDED."PointsPerStep","EnabledSinceUtc"=CASE WHEN NOT EXCLUDED."Enabled" THEN NULL WHEN loyalty_settings."Enabled" THEN loyalty_settings."EnabledSinceUtc" ELSE now() END,"UpdatedAtUtc"=now() RETURNING "Enabled","EarnEveryCents","PointsPerStep"),'+
   ' audited AS (INSERT INTO audit_events("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$1::uuid,$5::uuid,\'LoyaltySettings\',$1::text,\'Updated\',$6::uuid,$7,$8,jsonb_build_object(\'enabled\',s."Enabled",\'earnEveryCents\',s."EarnEveryCents",\'pointsPerStep\',s."PointsPerStep"),now(),1 FROM saved s RETURNING "Id")'+
   ' SELECT s."Enabled" AS enabled,s."EarnEveryCents" AS "earnEveryCents",s."PointsPerStep" AS "pointsPerStep" FROM saved s CROSS JOIN audited',
   [ctx.tenantId,data.enabled,earnEveryCents,pointsPerStep,ctx.branchId,ctx.userId,ctx.email,cid]
  );
  return result({configured:true,settings:r[0],message:"Política de fidelidade atualizada para novas vendas efetivamente pagas."},cid);
 },true);
}
