import {NextRequest} from "next/server";
import {FleetError,uuid} from "@/lib/fleet-session";
import {catalogHandler,MANAGE_PERMISSION,readBody,optionalText,expectedVersion,response} from "@/lib/catalog-server";
export async function PUT(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 return catalogHandler(request,MANAGE_PERMISSION,async(ctx,cid)=>{
  const id=uuid((await params).id,"Unidade"),b=await readBody(request),expected=expectedVersion(b.expectedVersion);
  const notes=optionalText(b.approvalNotes,600);
  if(!notes||notes.length<10)throw new FleetError(400,"INSPECTION_NOTES_REQUIRED","Informe no mínimo 10 caracteres com a conclusão real da inspeção.");
  const rows=await ctx.db.query(
   'WITH approved AS (UPDATE inventory_units SET "OperationalStatus"=3,"InspectionNotes"=CASE WHEN "InspectionNotes" IS NULL OR trim("InspectionNotes")=\'\' THEN $3 ELSE "InspectionNotes"||\' | Aprovação: \'||$3 END,"UpdatedAtUtc"=now() WHERE "Id"=$1::uuid AND "TenantId"=$2::uuid AND xmin::text::bigint=$4::bigint AND "OperationalStatus" IN (1,2) RETURNING "Id",xmin::text::bigint AS version,"OperationalStatus"),'+
   ' audited AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$2::uuid,$5::uuid,\'InventoryUnit\',u."Id"::text,\'ApprovedForSale\',$6::uuid,$7,$8,jsonb_build_object(\'notes\',$3,\'expectedVersion\',$4),now(),1 FROM approved u RETURNING "Id") SELECT u."Id"::text AS id,u.version,u."OperationalStatus" AS "operationalStatus" FROM approved u CROSS JOIN audited a',
   [id,ctx.tenantId,notes,expected,ctx.branchId,ctx.userId,ctx.email,cid]
  );
  if(!rows.length)throw new FleetError(409,"UNIT_APPROVAL_CONFLICT","Unidade não aprovada: versão alterada, registro inexistente, já aprovado ou em quarentena/vendido. Recarregue a listagem.");
  return response({...rows[0],message:"Aprovação da unidade registrada e auditada. A saída de estoque depende de venda efetiva."},cid);
 },true);
}
