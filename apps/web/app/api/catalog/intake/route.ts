import {NextRequest,NextResponse} from "next/server";
import crypto from "node:crypto";
import {authorizeFleet,guardOrigin,FleetError,uuid} from "@/lib/fleet-session";
const headers=(cid:string)=>({"Cache-Control":"no-store","X-Correlation-Id":cid});
function fail(e:unknown,cid:string){if(e instanceof FleetError)return NextResponse.json({error:e.message,code:e.code},{status:e.status,headers:headers(cid)});const c=(e as {code?:string})?.code;
 if(c==="42501")return NextResponse.json({error:"Permissão de catálogo/estoque necessária."},{status:403,headers:headers(cid)});
 if(["22023","22P02","22003","23502"].includes(c||""))return NextResponse.json({error:"Revise tipo, campos obrigatórios, peso, quantidade, custo e confirmação."},{status:422,headers:headers(cid)});
 if(["23514","23505","23503","40001","40P01"].includes(c||""))return NextResponse.json({error:"SKU ou saldo inicial já existente, cadastro inativo ou conflito de estoque. Use o produto existente ou confira o depósito."},{status:409,headers:headers(cid)});
 console.error("[CatalogIntake]["+cid+"]",c||"UNKNOWN");return NextResponse.json({error:"Cadastro indisponível. Nenhum resultado foi confirmado."},{status:503,headers:headers(cid)});
}
export async function GET(req:NextRequest){
 const cid=crypto.randomUUID();try{const ctx=await authorizeFleet(req,"catalog.products.view"),p=ctx.permissions;
 const canManage=p.has("catalog.products.manage"),canStock=canManage&&["inventory.view","inventory.adjust","inventory.cost.view"].every(k=>p.has(k));
 const [brands,categories,warehouses,skus]=await Promise.all([
 ctx.db.query('SELECT "Name" name FROM product_brands WHERE "TenantId"=$1::uuid AND "IsActive" ORDER BY "Name" LIMIT 500',[ctx.tenantId]),
 ctx.db.query('SELECT "Name" name FROM product_categories WHERE "TenantId"=$1::uuid AND "IsActive" AND "ParentCategoryId" IS NULL ORDER BY "Name" LIMIT 500',[ctx.tenantId]),
 canStock?ctx.db.query('SELECT "Id"::text id,"Name" name,"Code" code FROM warehouses WHERE "TenantId"=$1::uuid AND "BranchId"=$2::uuid AND "IsActive" ORDER BY "Name" LIMIT 500',[ctx.tenantId,ctx.branchId]):Promise.resolve([]),
 canStock?ctx.db.query(`SELECT s."Id"::text id,s."SkuCode" code,m."Name"||' · '||s."VariantName" name,m."Kind" kind,m."SerializationPolicy" policy FROM product_skus s JOIN product_models m ON m."Id"=s."ProductModelId" AND m."TenantId"=s."TenantId" WHERE s."TenantId"=$1::uuid AND s."IsActive" AND m."IsActive" AND m."SerializationPolicy"=0 AND m."Kind"<>4 ORDER BY m."Name",s."SkuCode" LIMIT 1000`,[ctx.tenantId]):Promise.resolve([])
 ]);
 return NextResponse.json({brands,categories,warehouses,skus,canManage,canStock},{headers:headers(cid)});
 }catch(e){return fail(e,cid);}
}
export async function POST(req:NextRequest){
 const cid=crypto.randomUUID();try{guardOrigin(req);const ctx=await authorizeFleet(req,"catalog.products.manage");const raw=await req.text();if(raw.length>20000)throw new FleetError(413,"SIZE_LIMIT","Cadastro muito extenso.");
 let body:any;try{body=JSON.parse(raw);}catch{throw new FleetError(422,"INVALID_BODY","Dados inválidos.");}
 if(!body||!body.data||typeof body.data!=="object"||Array.isArray(body.data)||!["CATALOG","STOCK","FILAMENT","SUPPLY"].includes(body.data.mode))throw new FleetError(422,"INVALID_BODY","Tipo de cadastro inválido.");
 if(body.data.mode!=="CATALOG"&&!["inventory.view","inventory.adjust","inventory.cost.view"].every(k=>ctx.permissions.has(k)))throw new FleetError(403,"FORBIDDEN","Permissões de estoque e custos necessárias.");
 const [row]=await ctx.db.query("SELECT public.catalog_intake_v7($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::jsonb) result",[ctx.tenantId,ctx.branchId,ctx.userId,uuid(body.requestId,"Operação"),JSON.stringify(body.data)]);
 return NextResponse.json({result:row.result},{headers:headers(cid)});
 }catch(e){return fail(e,cid);}
}
