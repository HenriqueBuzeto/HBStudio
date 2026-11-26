import {NextRequest} from "next/server";
import {inventoryRead} from "@/lib/inventory-read";
export async function GET(request:NextRequest){return inventoryRead(request,"kardex");}
