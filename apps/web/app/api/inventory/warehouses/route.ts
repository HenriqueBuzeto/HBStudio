import {NextRequest,NextResponse} from "next/server";
import {inventoryRead} from "@/lib/inventory-read";
import {authorizeFleet,FleetError,guardOrigin,uuid} from "@/lib/fleet-session";
export async function GET(request:NextRequest){return inventoryRead(request,"warehouses");}
export async function POST(request:NextRequest){
 const headers={"Cache-Control":"no-store"};
 try{guardOrigin(request);const ctx=await authorizeFleet(request,"inventory.adjust");if(!ctx.permissions.has("inventory.view"))throw new FleetError(403,"FORBIDDEN","Permissão de estoque necessária.");
 const raw=await request.text();if(raw.length>5000)throw new FleetError(413,"SIZE_LIMIT","Dados muito extensos.");
 let body:any;try{body=JSON.parse(raw);}catch{throw new FleetError(422,"INVALID_BODY","Dados inválidos.");}
 if(!body?.data||typeof body.data!=="object"||Array.isArray(body.data))throw new FleetError(422,"INVALID_BODY","Dados inválidos.");
 const [row]=await ctx.db.query("SELECT public.inventory_create_warehouse_v7($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::jsonb) result",[ctx.tenantId,ctx.branchId,ctx.userId,uuid(body.requestId,"Operação"),JSON.stringify(body.data)]);
 return NextResponse.json({result:row.result},{headers});
 }catch(e){if(e instanceof FleetError)return NextResponse.json({error:e.message,code:e.code},{status:e.status,headers});const c=(e as {code?:string})?.code;if(c==="42501")return NextResponse.json({error:"Operação não autorizada."},{status:403,headers});if(c==="23505"||c==="23514")return NextResponse.json({error:"Depósito já existe ou operação conflitante."},{status:409,headers});if(["22023","22P02","22003"].includes(c||""))return NextResponse.json({error:"Revise código, nome e tipo."},{status:422,headers});console.error("[Warehouse]",c||"UNKNOWN");return NextResponse.json({error:"Depósito não confirmado."},{status:503,headers});}
}
