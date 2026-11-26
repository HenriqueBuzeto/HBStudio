import {NextRequest,NextResponse,connection} from "next/server";
import {authorizeFleet,FleetError,guardOrigin} from "@/lib/fleet-session";
import {fleetSource} from "@/lib/fleet-source";
import {NOTIFICATION_PERMISSIONS} from "@/lib/notification-policy";
const headers={"Cache-Control":"private, no-store"};
async function context(req:NextRequest){
 const ctx=await authorizeFleet(req,NOTIFICATION_PERMISSIONS);
 const rows=await ctx.db.query('SELECT current_setting(\'neon.branch_id\',true) branch,b."Name" name FROM branches b WHERE b."TenantId"=$1::uuid AND b."Id"=$2::uuid AND b."IsActive"',[ctx.tenantId,ctx.branchId]);
 const source=rows[0]?fleetSource(rows[0].branch,process.env.VERCEL_ENV,rows[0].name):null;
 if(!source)throw new FleetError(503,"SOURCE_UNVERIFIED","Origem das notificações não confirmada.");
 return {ctx,source};
}
function fail(e:unknown){if(e instanceof FleetError)return NextResponse.json({error:e.message,code:e.code},{status:e.status,headers});console.error("[Notifications]",(e as {code?:string})?.code||"UNKNOWN");return NextResponse.json({error:"Não foi possível consultar ou atualizar as notificações."},{status:503,headers});}
export async function GET(req:NextRequest){await connection();try{
 const {ctx,source}=await context(req);
 const rows=await ctx.db.query(`WITH feed AS MATERIALIZED(SELECT * FROM public.erp_notifications_v18($1::uuid,$2::uuid,$3::uuid)),
 ranked AS (SELECT *,CASE severity WHEN 'urgent' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END priority FROM feed ORDER BY (read_at IS NOT NULL),CASE severity WHEN 'urgent' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,event_at DESC,notification_key LIMIT 100)
 SELECT (SELECT count(*)::int FROM feed) total,(SELECT count(*)::int FROM feed WHERE read_at IS NULL) unread,(SELECT count(*)::int FROM feed WHERE severity='urgent') urgent,
 coalesce((SELECT jsonb_agg(jsonb_build_object('key',notification_key,'category',category,'severity',severity,'title',title,'description',description,'href',href,'eventAt',event_at,'readAt',read_at) ORDER BY (read_at IS NOT NULL),priority,event_at DESC,notification_key) FROM ranked),'[]'::jsonb) items,now() "checkedAt"`,[ctx.tenantId,ctx.branchId,ctx.userId]);
 return NextResponse.json({...rows[0],writable:source.writable},{headers});
 }catch(e){return fail(e);}}
export async function POST(req:NextRequest){await connection();try{
 guardOrigin(req);const {ctx,source}=await context(req);if(!source.writable)throw new FleetError(403,"READ_ONLY","Ambiente somente leitura.");
 const raw=await req.text();if(raw.length>25000)throw new FleetError(413,"SIZE","Solicitação extensa.");let body:unknown;try{body=JSON.parse(raw);}catch{throw new FleetError(422,"INVALID","Dados inválidos.");}
 if(!body||typeof body!=="object"||Array.isArray(body))throw new FleetError(422,"INVALID","Dados inválidos.");
 const {action,keys}=body as {action?:unknown;keys?:unknown};
 if(action!=="READ"&&action!=="READ_ALL")throw new FleetError(422,"INVALID","Ação inválida.");
 if(action==="READ"&&(!Array.isArray(keys)||keys.length<1||keys.length>100||!keys.every(k=>typeof k==="string"&&k.length>=1&&k.length<=220)))throw new FleetError(422,"INVALID","Notificação inválida.");
 const rows=await ctx.db.query("SELECT public.erp_notifications_read_v18($1::uuid,$2::uuid,$3::uuid,$4::text[],$5::boolean) updated",[ctx.tenantId,ctx.branchId,ctx.userId,action==="READ"?keys:null,action==="READ_ALL"]);
 return NextResponse.json({updated:rows[0].updated},{headers});
 }catch(e){return fail(e);}}
