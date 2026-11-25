import {NextRequest,NextResponse} from "next/server";
import crypto from "node:crypto";
import {authorizeFleet,FleetError,guardOrigin} from "@/lib/fleet-session";

export async function POST(request:NextRequest){
 const cid=crypto.randomUUID();
 const headers={"Cache-Control":"no-store","X-Correlation-Id":cid};
 try{
  guardOrigin(request);
  const ctx=await authorizeFleet(request,"manufacturing.quote");
  if(!ctx.permissions.has("manufacturing.cost.view")&&!ctx.permissions.has("manufacturing.costs.view"))
   throw new FleetError(403,"FORBIDDEN","Permissão de custos industriais necessária.");
  const raw=await request.text();
  if(raw.length>64000)throw new FleetError(413,"BODY_TOO_LARGE","Estimativa muito extensa.");
  let data:any;
  try{data=JSON.parse(raw);}catch{throw new FleetError(422,"INVALID_ESTIMATE","Dados inválidos.");}
  if(!data||typeof data!=="object"||Array.isArray(data)||!Array.isArray(data.filaments)||!Array.isArray(data.supplies))
   throw new FleetError(422,"INVALID_ESTIMATE","Informe os materiais e insumos.");
  const numeric=(v:unknown,integer=false)=>{
   if(typeof v!=="number"||!Number.isFinite(v)||v<0||(integer&&!Number.isSafeInteger(v)))
    throw new FleetError(422,"INVALID_ESTIMATE","Parâmetro numérico inválido.");
   return v;
  };
  const [row]=await ctx.db.query(
   "SELECT public.manufacturing_estimate_cost_v1($1::jsonb,$2::jsonb,$3::integer,$4::numeric,$5::numeric,$6::numeric,$7::integer,$8::numeric,$9::numeric,$10::numeric,$11::numeric,$12::numeric) AS estimate",
   [JSON.stringify(data.filaments),JSON.stringify(data.supplies),numeric(data.seconds,true),numeric(data.watts),numeric(data.tariff),numeric(data.machineHour),numeric(data.laborSeconds,true),numeric(data.laborHour),numeric(data.other),numeric(data.wastePct),numeric(data.marginPct),numeric(data.feePct)]
  );
  return NextResponse.json({estimate:row.estimate,version:1,source:"MANUAL_ESTIMATE",persisted:false},{headers});
 }catch(e){
  if(e instanceof FleetError)return NextResponse.json({code:e.code,error:e.message},{status:e.status,headers});
  if(typeof e==="object"&&e!==null&&"code" in e&&e.code==="22023")return NextResponse.json({code:"INVALID_ESTIMATE",error:"Revise quantidades, custos e percentuais. Margem e taxas devem somar menos de 100%."},{status:422,headers});
  console.error("[ManufacturingEstimate]["+cid+"]",e instanceof Error?e.name:"Unknown");
  return NextResponse.json({code:"ESTIMATE_UNAVAILABLE",error:"Motor de estimativas indisponível."},{status:503,headers});
 }
}
