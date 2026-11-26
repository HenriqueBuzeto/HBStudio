import {NextRequest,NextResponse,connection} from "next/server";
import crypto from "node:crypto";
import {authorizeFleet,FleetError} from "@/lib/fleet-session";
import {REPORTS,REPORT_PERMISSIONS,canReadReport,buildReportSql,validReportRange} from "@/lib/report-definitions";
export async function GET(req:NextRequest){
 await connection();
 const cid=crypto.randomUUID(),headers={"Cache-Control":"no-store","X-Correlation-Id":cid};try{
 const ctx=await authorizeFleet(req,REPORT_PERMISSIONS),q=req.nextUrl.searchParams,id=q.get("report");
 const allowed=REPORTS.filter(r=>canReadReport(r,ctx.permissions));
 if(!id)return NextResponse.json({reports:allowed.map(({sql,order,permissions,...meta})=>meta)},{headers});
 const r=allowed.find(x=>x.id===id);if(!r)throw new FleetError(403,"REPORT_FORBIDDEN","Relatório não disponível para suas permissões.");
 const snapshot=r.mode==="current"||r.mode==="company";const from=snapshot?"2000-01-01":q.get("from"),to=snapshot?"2000-01-01":q.get("to");
 if(!validReportRange(from,to))throw new FleetError(400,"REPORT_RANGE","Informe datas válidas e selecione até 366 dias.");
 const page=Number(q.get("page")||1),exporting=q.get("export")==="1",search=(q.get("search")||"").trim();
 if(!Number.isSafeInteger(page)||page<1||page>100000||search.length>120)throw new FleetError(400,"REPORT_FILTER","Filtro inválido.");
 const size=exporting?5001:100,offset=exporting?0:(page-1)*size;
 // SQL fragments are from the server catalog only.
 const [out]=await ctx.db.query(buildReportSql(r),[ctx.tenantId,ctx.branchId,from,to,search,size,offset]);
 if(exporting&&out.count>5000)throw new FleetError(422,"REPORT_EXPORT_LIMIT","Mais de 5.000 registros. Reduza o período ou filtre antes de exportar.");
 const rows=(out.rows||[]).map((row:Record<string,unknown>)=>Object.fromEntries(r.columns.map(c=>[c.key,row[c.key]??null])));
 return NextResponse.json({report:r.id,count:out.count,metrics:out.metrics,rows,page,size,generatedAt:new Date().toISOString(),scope:r.mode.startsWith("company")?"Empresa inteira":"Filial da sessão"},{headers});
 }catch(e){if(e instanceof FleetError)return NextResponse.json({error:e.message,code:e.code},{status:e.status,headers});console.error("[Reports]["+cid+"]",(e as {code?:string})?.code||"UNKNOWN");return NextResponse.json({error:"Relatório indisponível. Nenhum valor foi confirmado. Referência: "+cid},{status:503,headers});}
}
