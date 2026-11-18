import {NextRequest} from "next/server";
import {FleetError,uuid} from "@/lib/fleet-session";
import {catalogHandler,READ_PERMISSION,getModelById,response} from "@/lib/catalog-server";

export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 return catalogHandler(request,READ_PERMISSION,async(ctx,cid)=>{
  const id=uuid((await params).id,"Modelo");
  const model=await getModelById(ctx,id);
  if(!model)throw new FleetError(404,"MODEL_NOT_FOUND","Modelo não encontrado na sua empresa.");
  return response(model,cid);
 });
}
