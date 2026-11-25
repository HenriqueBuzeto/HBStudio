import {NextRequest,NextResponse} from "next/server";
import crypto from "node:crypto";
import {inflateRawSync} from "node:zlib";
import {authorizeFleet,FleetError,guardOrigin,uuid} from "@/lib/fleet-session";
import {parseFile} from "@/lib/factory-slicer.mjs";

const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
const fail=(e:unknown)=>{if(e instanceof FleetError)return NextResponse.json({error:e.message,code:e.code},{status:e.status,headers});const code=(e as {code?:string})?.code;if(["22023","22P02","23502"].includes(code||""))return NextResponse.json({error:"Arquivo ou dados inválidos."},{status:422,headers});if(["23514","23505","23503"].includes(code||""))return NextResponse.json({error:"Revisão duplicada, limite de armazenamento ou conflito."},{status:409,headers});console.error("[FactoryFiles]",e instanceof Error?e.name:"Unknown");return NextResponse.json({error:"Biblioteca indisponível."},{status:503,headers});};
export async function GET(req:NextRequest){
 try{const ctx=await authorizeFleet(req,"manufacturing.view");const id=uuid(req.nextUrl.searchParams.get("versionId"),"Versão");
 const [r]=await ctx.db.query(`SELECT filename,encode(content,'base64') body FROM manufacturing_factory_files WHERE tenant_id=$1::uuid AND branch_id=$2::uuid AND version_id=$3::uuid`,[ctx.tenantId,ctx.branchId,id]);if(!r)throw new FleetError(404,"NOT_FOUND","Arquivo não localizado.");
 const name=String(r.filename).replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,180)||"projeto";
 return new NextResponse(new Uint8Array(Buffer.from(r.body,"base64")),{headers:{...headers,"Content-Type":"application/octet-stream","Content-Disposition":'attachment; filename="'+name+'"',"Content-Security-Policy":"default-src 'none'; sandbox"}});
 }catch(e){return fail(e);}
}
export async function POST(req:NextRequest){
 try{guardOrigin(req);const ctx=await authorizeFleet(req,"manufacturing.view");if(!ctx.permissions.has("manufacturing.orders.manage"))throw new FleetError(403,"FORBIDDEN","Permissão de gestão industrial necessária.");
 const length=Number(req.headers.get("content-length")||0);if(length>2300000)throw new FleetError(413,"SIZE_LIMIT","Limite de arquivo: 2 MiB.");
 if(!req.headers.get("content-type")?.startsWith("multipart/form-data"))throw new FleetError(415,"INVALID_CONTENT_TYPE","Envie um arquivo.");
 const form=await req.formData(),file=form.get("file");if(!(file instanceof File)||file.size<1||file.size>2097152)throw new FleetError(413,"SIZE_LIMIT","Arquivo obrigatório, até 2 MiB.");
 const assetId=uuid(form.get("assetId"),"Projeto"),requestId=uuid(form.get("requestId"),"Operação");
 const revision=String(form.get("revision")||"").trim(),notes=String(form.get("notes")||"").trim(),filename=file.name;
 if(!revision||revision.length>40||notes.length>2000||filename.length>180||/[\u0000-\u001f\u007f/\\]/.test(filename))throw new FleetError(422,"INVALID_FIELDS","Revise nome, revisão e notas.");
 const bytes=Buffer.from(await file.arrayBuffer());let meta;
 try{meta=parseFile(filename,bytes,(data:Uint8Array,max:number)=>inflateRawSync(data,{maxOutputLength:max}));}catch{throw new FleetError(422,"INVALID_FILE","Arquivo ou metadados de fatiamento não reconhecidos.");}
 const format=filename.toLowerCase().endsWith(".3mf")?"3MF":filename.toLowerCase().endsWith(".gcode")?"GCODE":"STL";
 const sha256=crypto.createHash("sha256").update(bytes).digest("hex");
 // Legacy estimate fields cannot represent unknown. Keep zeros only there; metadata retains nulls and separate plates.
 const known=meta.plates.length>0&&meta.plates.every((p:{seconds:number|null;totalGrams:number|null})=>p.seconds!==null&&p.totalGrams!==null);
 const seconds=known?meta.plates.reduce((n:number,p:{seconds:number|null})=>n+(p.seconds??0),0):0;
 const grams=known?meta.plates.reduce((n:number,p:{totalGrams:number|null})=>n+(p.totalGrams??0),0):0;
 const payload={assetId,filename,format,revision,sha256,metadata:meta,seconds,grams,notes};
 const [r]=await ctx.db.query("SELECT public.factory_create_version_v3($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::jsonb,decode($6,'base64')) AS result",[ctx.tenantId,ctx.branchId,ctx.userId,requestId,JSON.stringify(payload),bytes.toString("base64")]);
 return NextResponse.json({result:r.result,metadata:meta},{headers});
 }catch(e){return fail(e);}
}
