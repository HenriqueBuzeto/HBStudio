import {NextRequest} from "next/server";
import {FleetError,uuid} from "@/lib/fleet-session";
import {catalogHandler,READ_PERMISSION,getUnitById,response} from "@/lib/catalog-server";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 return catalogHandler(request,READ_PERMISSION,async(ctx,cid)=>{
  const id=uuid((await params).id,"Unidade");
  const unit=await getUnitById(ctx,id);
  if(!unit)throw new FleetError(404,"UNIT_NOT_FOUND","Unidade não encontrada nesta empresa.");
  return response(unit,cid);
 });
}
