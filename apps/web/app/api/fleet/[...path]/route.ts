import { NextRequest, NextResponse, connection } from "next/server";
import crypto from "crypto";
import {fleetSource} from "@/lib/fleet-source";
import { authorizeFleet, guardOrigin, FleetError, uuid, string, optional, decimal, enumValue, type FleetSession } from "@/lib/fleet-session";

const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
function issue(e:unknown,cid:string){
 if(e instanceof FleetError)return NextResponse.json({code:e.code,error:e.message},{status:e.status,headers:{"X-Correlation-Id":cid,"Cache-Control":"no-store"}});
 const message=e instanceof Error?e.message:"unknown";
 console.error("[FLEET]["+cid+"]",e instanceof Error?e.name:"unknown");
 if(/unique|duplicate key|23505/i.test(message))return NextResponse.json({code:"DUPLICATE",error:"Já existe veículo ou viagem com esta identificação."},{status:409});
 return NextResponse.json({code:"FLEET_DATABASE_ERROR",error:"Operação não concluída. Verifique os dados e tente novamente."},{status:503,headers:{"X-Correlation-Id":cid}});
}
async function body(req:NextRequest):Promise<Record<string,unknown>>{
 if(Number(req.headers.get("content-length")||0)>16000)throw new FleetError(413,"TOO_LARGE","Dados muito extensos.");
 const value:unknown=await req.json().catch(()=>null);
 if(!value||typeof value!=="object"||Array.isArray(value))throw new FleetError(400,"INVALID_JSON","Informe um objeto JSON válido.");
 return value as Record<string,unknown>;
}
async function audit(ctx:FleetSession,entity:string,id:string,action:string,details:unknown,cid:string){
 // usado apenas em leituras ou em tarefas sem escrita; mutações usam CTE auditável atômica.
 return ctx.db.query('INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") VALUES(gen_random_uuid(),$1::uuid,$2::uuid,$3,$4,$5,$6::uuid,$7,$8,$9::jsonb,now(),1)',[ctx.tenantId,ctx.branchId,entity,id,action,ctx.userId,ctx.email,cid,JSON.stringify(details)]);
}
async function overview(ctx:FleetSession){
 const [vehicles,trips,maintenance,fuelings,partners]=await Promise.all([
  ctx.db.query('SELECT v."Id"::text AS id,v."InternalCode" AS name,v."Plate" AS plate,v."Brand" AS brand,v."Model" AS model,v."Year" AS year,v."Type" AS type,v."Ownership" AS ownership,v."Fuel" AS fuel,v."TankCapacityLiters"::float8 AS "tankLiters",v."AverageConsumptionKmPerLiter"::float8 AS "kmPerLiter",v."InitialOdometerKm"::float8 AS "initialKm",v."CurrentOdometerKm"::float8 AS "currentKm",v."OwnerPartnerId"::text AS "partnerId",v."ResponsibleName" AS "ownerName",v."Status" AS status,v."Notes" AS notes,v."CreatedAtUtc" AS "createdAt",v.xmin::text AS version FROM fleet_vehicles v WHERE v."TenantId"=$1::uuid AND v."BranchId"=$2::uuid ORDER BY v."InternalCode",v."Id"',[ctx.tenantId,ctx.branchId]),
  ctx.db.query('SELECT t."Id"::text AS id,t."TripNumber" AS number,t."VehicleId"::text AS "vehicleId",v."Plate" AS plate,v."InternalCode" AS "vehicleName",t."DriverName" AS driver,t."Purpose" AS purpose,t."OriginCity" AS origin,t."DestinationCity" AS destination,t."Description" AS description,t."InitialOdometerKm"::float8 AS "startKm",t."FinalOdometerKm"::float8 AS "endKm",t."DistanceKm"::float8 AS distance,t."Status" AS status,t."StartTimeUtc" AS "startedAt",t."EndTimeUtc" AS "endedAt",t."Notes" AS notes,t."TotalFuelExpenses"::float8 AS "fuelExpenses",t.xmin::text AS version FROM fleet_trips t JOIN fleet_vehicles v ON v."Id"=t."VehicleId" AND v."TenantId"=t."TenantId" AND v."BranchId"=t."BranchId" WHERE t."TenantId"=$1::uuid AND t."BranchId"=$2::uuid ORDER BY t."StartTimeUtc" DESC LIMIT 500',[ctx.tenantId,ctx.branchId]),
  ctx.db.query('SELECT p."Id"::text AS id,p."VehicleId"::text AS "vehicleId",p."PlanName" AS name,p."RecommendedIntervalKm" AS "intervalKm",p."RecommendedIntervalDays" AS "intervalDays",p."NextServiceOdometerKm"::float8 AS "nextKm",p."NextServiceDateUtc" AS "nextDate",p."IsActive" AS active FROM fleet_maintenance_plans p JOIN fleet_vehicles v ON v."Id"=p."VehicleId" AND v."TenantId"=p."TenantId" AND v."BranchId"=$2::uuid WHERE p."TenantId"=$1::uuid AND p."IsActive"=true ORDER BY p."PlanName"',[ctx.tenantId,ctx.branchId]),
  ctx.permissions.has("fleet.cost.view") ? ctx.db.query('SELECT f."Id"::text AS id,f."VehicleId"::text AS "vehicleId",f."TripId"::text AS "tripId",f."FuelingDateUtc" AS date,f."GasStationName" AS station,f."TotalAmount"::float8 AS amount,f."Liters"::float8 AS liters,f."OdometerKm"::float8 AS odometer FROM fleet_fuelings f WHERE f."TenantId"=$1::uuid AND f."BranchId"=$2::uuid ORDER BY f."FuelingDateUtc" DESC LIMIT 100',[ctx.tenantId,ctx.branchId]) : Promise.resolve([]),
  ctx.db.query('SELECT "Id"::text AS id,"Name" AS name FROM partners WHERE "TenantId"=$1::uuid AND "Status"=1 ORDER BY "Name"',[ctx.tenantId])
 ]);
 return {vehicles,trips,maintenance,fuelings,partners};
}
function positiveOptional(v:unknown,label:string,max=100000):number|null{
 if(v===""||v===undefined||v===null)return null;
 return decimal(v,label,false,max);
}
async function registerVehicle(ctx:FleetSession,b:Record<string,unknown>,cid:string){
 const name=string(b.name,"Nome/código do veículo",65).toUpperCase();
 const plate=string(b.plate,"Placa",8).replace(/[-\s]/g,"").toUpperCase();
 if(!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate))throw new FleetError(400,"PLATE_INVALID","Informe placa brasileira válida (AAA1234 ou AAA1A23).");
 const brand=string(b.brand,"Marca",65),model=string(b.model,"Modelo",100);
 const year=enumValue(b.year,"Ano",Array.from({length:90},(_,i)=>1950+i));
 const type=enumValue(b.type,"Tipo",[1,2,3,4,5]);
 const ownership=enumValue(b.ownership,"Propriedade",[1,2,3,4,5]);
 const fuel=enumValue(b.fuel,"Combustível",[1,2,3,4,5,6]);
 const odometer=decimal(b.odometer,"Hodômetro inicial");
 const consumption=positiveOptional(b.kmPerLiter,"Consumo km/L",100);
 const tank=positiveOptional(b.tankLiters,"Capacidade do tanque",2000);
 const ownerName=string(b.ownerName,"Proprietário ou responsável",180);
 const notes=optional(b.notes,1500);
 const partnerId=b.partnerId?uuid(b.partnerId,"Sócio proprietário"):null;
 if(ownership===2&&!partnerId)throw new FleetError(400,"PARTNER_REQUIRED","Selecione o sócio proprietário oficial.");
 if(fuel===5&&consumption!==null)throw new FleetError(400,"CONSUMPTION_UNSUPPORTED","Veículo elétrico exige consumo em kWh, não km/L.");
 const rows=await ctx.db.query(
  'WITH vehicle AS (INSERT INTO fleet_vehicles ("Id","TenantId","BranchId","InternalCode","Plate","Brand","Model","Year","Type","Ownership","Fuel","TankCapacityLiters","InitialOdometerKm","CurrentOdometerKm","AverageConsumptionKmPerLiter","OwnerPartnerId","ResponsibleName","Status","UtilizationStartDateUtc","Notes","CreatedAtUtc")' +
  ' SELECT gen_random_uuid(),$1::uuid,$2::uuid,$3,$4,$5,$6,$7::int,$8::int,$9::int,$10::int,$11::numeric,$12::numeric,$12::numeric,$13::numeric,$14::uuid,$15,1,now(),$16,now()' +
  ' WHERE ($14::uuid IS NULL OR EXISTS(SELECT 1 FROM partners p WHERE p."Id"=$14::uuid AND p."TenantId"=$1::uuid AND p."Status"=1)) RETURNING "Id","Plate"),' +
  ' event AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$1::uuid,$2::uuid,\'FleetVehicle\',v."Id"::text,\'Created\',$17::uuid,$18,$19,jsonb_build_object(\'plate\',v."Plate",\'owner\',$15,\'kmPerLiter\',$13),now(),1 FROM vehicle v RETURNING "Id")' +
  ' SELECT v."Id"::text AS id FROM vehicle v CROSS JOIN event',
  [ctx.tenantId,ctx.branchId,name,plate,brand,model,year,type,ownership,fuel,tank,odometer,consumption,partnerId,ownerName,notes,ctx.userId,ctx.email,cid]
 );
 if(!rows.length)throw new FleetError(409,"PARTNER_INVALID","Sócio proprietário não encontrado nesta empresa.");
 return rows[0];
}
async function editVehicle(ctx:FleetSession,id:string,b:Record<string,unknown>,cid:string){
 const version=string(b.version,"Versão",30);if(!/^\d+$/.test(version))throw new FleetError(400,"VERSION_INVALID","Versão inválida.");
 const brand=string(b.brand,"Marca",65),model=string(b.model,"Modelo",100),owner=string(b.ownerName,"Proprietário ou responsável",180);
 const tank=positiveOptional(b.tankLiters,"Capacidade do tanque",2000),consumption=positiveOptional(b.kmPerLiter,"Consumo km/L",100),notes=optional(b.notes,1500);
 const status=enumValue(b.status,"Situação",[1,3,4,5]);
 const rows=await ctx.db.query(
  'WITH vehicle AS (UPDATE fleet_vehicles v SET "Brand"=$4,"Model"=$5,"ResponsibleName"=$6,"TankCapacityLiters"=$7::numeric,"AverageConsumptionKmPerLiter"=$8::numeric,"Notes"=$9,"Status"=$10::int,"UpdatedAtUtc"=now() WHERE v."TenantId"=$1::uuid AND v."BranchId"=$2::uuid AND v."Id"=$3::uuid AND v.xmin::text=$11 AND v."Status"<>2 AND NOT EXISTS(SELECT 1 FROM fleet_trips t WHERE t."VehicleId"=v."Id" AND t."TenantId"=v."TenantId" AND t."Status"=3) RETURNING v."Id",v."Plate"),' +
  ' event AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$1::uuid,$2::uuid,\'FleetVehicle\',v."Id"::text,\'Updated\',$12::uuid,$13,$14,jsonb_build_object(\'plate\',v."Plate",\'owner\',$6,\'kmPerLiter\',$8,\'status\',$10),now(),1 FROM vehicle v RETURNING "Id") SELECT v."Id"::text AS id FROM vehicle v CROSS JOIN event',
  [ctx.tenantId,ctx.branchId,id,brand,model,owner,tank,consumption,notes,status,version,ctx.userId,ctx.email,cid]
 );
 if(!rows.length)throw new FleetError(409,"FLEET_CONFLICT","Veículo alterado por outro usuário, em viagem ou não encontrado. Atualize a tela.");
 return rows[0];
}
async function correctOdometer(ctx:FleetSession,id:string,b:Record<string,unknown>,cid:string){
 const value=decimal(b.odometer,"Hodômetro corrigido"),reason=string(b.reason,"Justificativa",400),version=string(b.version,"Versão",30);
 const rows=await ctx.db.query(
  'WITH vehicle AS (UPDATE fleet_vehicles v SET "CurrentOdometerKm"=$4::numeric,"UpdatedAtUtc"=now() WHERE v."TenantId"=$1::uuid AND v."BranchId"=$2::uuid AND v."Id"=$3::uuid AND v.xmin::text=$5 AND v."Status"<>2 RETURNING v."Id"),' +
  ' event AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$1::uuid,$2::uuid,\'FleetVehicle\',v."Id"::text,\'OdometerCorrected\',$6::uuid,$7,$8,jsonb_build_object(\'km\',$4,\'reason\',$9),now(),1 FROM vehicle v RETURNING "Id") SELECT v."Id"::text AS id FROM vehicle v CROSS JOIN event',
  [ctx.tenantId,ctx.branchId,id,value,version,ctx.userId,ctx.email,cid,reason]
 );
 if(!rows.length)throw new FleetError(409,"FLEET_CONFLICT","Hodômetro não alterado; atualize os dados.");
 return rows[0];
}
async function startTrip(ctx:FleetSession,b:Record<string,unknown>,cid:string){
 const vehicleId=uuid(b.vehicleId,"Veículo"),driver=string(b.driver,"Condutor",180),origin=string(b.origin,"Origem",140),destination=string(b.destination,"Destino",140),purpose=enumValue(b.purpose,"Finalidade",[1,2,3,4,5,6,7,8]),description=optional(b.description,1400);
 const startKm=decimal(b.startKm,"Hodômetro inicial");
 const tripNumber="TRIP-"+new Date().toISOString().slice(0,10).replace(/-/g,"")+"-"+crypto.randomUUID().slice(0,8).toUpperCase();
 const rows=await ctx.db.query(
  'WITH claimed AS (UPDATE fleet_vehicles v SET "Status"=2,"UpdatedAtUtc"=now() WHERE v."TenantId"=$1::uuid AND v."BranchId"=$2::uuid AND v."Id"=$3::uuid AND v."Status"=1 AND v."CurrentOdometerKm"=$9::numeric AND NOT EXISTS(SELECT 1 FROM fleet_trips t WHERE t."TenantId"=v."TenantId" AND t."VehicleId"=v."Id" AND t."Status"=3) RETURNING v."Id"),' +
  ' trip AS (INSERT INTO fleet_trips ("Id","TenantId","BranchId","TripNumber","VehicleId","DriverUserId","DriverName","Purpose","OriginCity","DestinationCity","Description","StartTimeUtc","InitialOdometerKm","DistanceKm","Status","TotalFuelExpenses","TotalOtherExpenses","TotalAllocatedCost","CreatedAtUtc")' +
  ' SELECT gen_random_uuid(),$1::uuid,$2::uuid,$4,claimed."Id",$5::uuid,$6,$7::int,$8,$10,$11,now(),$9::numeric,0,3,0,0,0,now() FROM claimed RETURNING "Id","TripNumber"),' +
  ' event AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$1::uuid,$2::uuid,\'FleetTrip\',trip."Id"::text,\'Started\',$5::uuid,$12,$13,jsonb_build_object(\'tripNumber\',trip."TripNumber",\'vehicleId\',$3),now(),1 FROM trip RETURNING "Id")' +
  ' SELECT trip."Id"::text AS id FROM trip CROSS JOIN event',
  [ctx.tenantId,ctx.branchId,vehicleId,tripNumber,ctx.userId,driver,purpose,origin,startKm,destination,description,ctx.email,cid]
 );
 if(!rows.length)throw new FleetError(409,"FLEET_VEHICLE_UNAVAILABLE","Veículo indisponível, hodômetro mudou ou já está em viagem.");
 return rows[0];
}
async function finishTrip(ctx:FleetSession,id:string,b:Record<string,unknown>,cid:string){
 const finalKm=decimal(b.finalKm,"Hodômetro final"),version=string(b.version,"Versão",32),notes=optional(b.notes,700);
 if(!/^\\d+$/.test(version))throw new FleetError(400,"VERSION_INVALID","Versão inválida.");
 // SELECT FOR UPDATE preserva a ordem: bloqueia a viagem, atualiza veículo e
 // finaliza a viagem somente quando ambos podem ser modificados.
 const rows=await ctx.db.query(
  'WITH locked AS (SELECT t."Id",t."VehicleId",t."InitialOdometerKm" FROM fleet_trips t WHERE t."TenantId"=$1::uuid AND t."BranchId"=$2::uuid AND t."Id"=$3::uuid AND t."Status"=3 AND t.xmin::text=$6 AND $4::numeric>=t."InitialOdometerKm" FOR UPDATE),' +
  ' vehicle AS (UPDATE fleet_vehicles v SET "CurrentOdometerKm"=$4::numeric,"Status"=1,"UpdatedAtUtc"=now() WHERE v."Id"=(SELECT locked."VehicleId" FROM locked) AND v."TenantId"=$1::uuid AND v."BranchId"=$2::uuid AND v."Status"=2 AND $4::numeric>=v."CurrentOdometerKm" RETURNING v."Id"),' +
  ' trip AS (UPDATE fleet_trips t SET "FinalOdometerKm"=$4::numeric,"DistanceKm"=$4::numeric-t."InitialOdometerKm","Status"=4,"EndTimeUtc"=now(),"Notes"=$5,"UpdatedAtUtc"=now() FROM vehicle v WHERE t."Id"=(SELECT locked."Id" FROM locked) AND t."VehicleId"=v."Id" AND t."TenantId"=$1::uuid AND t."BranchId"=$2::uuid RETURNING t."Id",t."VehicleId",t."DistanceKm"),' +
  ' event AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$1::uuid,$2::uuid,\'FleetTrip\',t."Id"::text,\'Completed\',$7::uuid,$8,$9,jsonb_build_object(\'distanceKm\',t."DistanceKm",\'finalKm\',$4),now(),1 FROM trip t RETURNING "Id") SELECT trip."Id"::text AS id FROM trip CROSS JOIN event',
  [ctx.tenantId,ctx.branchId,id,finalKm,notes,version,ctx.userId,ctx.email,cid]
 );
 if(!rows.length)throw new FleetError(409,"FLEET_CONFLICT","Viagem ou hodômetro alterado; atualize a tela antes de concluir.");
 return rows[0];
}

type RouteContext={params:Promise<{path:string[]}>};
async function handle(request:NextRequest,ctx:RouteContext,method:"GET"|"POST"|"PATCH"){
 await connection();
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 try {
  const path=(await ctx.params).path;
  if(method!=="GET")guardOrigin(request);
  let permission="fleet.view";
  if(method!=="GET"){
   if(path[0]==="vehicles")permission=path.length===3&&path[2]==="odometer"?"fleet.odometer.correct":"fleet.vehicles.manage";
   else if(path[0]==="trips")permission=path.length===3&&path[2]==="complete"?"fleet.trips.close":"fleet.trips.create";
   else throw new FleetError(404,"NOT_FOUND","Rota não encontrada.");
  }
  const auth=await authorizeFleet(request,permission);
  const identity=await auth.db.query('SELECT current_setting(\'neon.branch_id\',true) AS "neonBranch",b."Name" AS "branchName" FROM branches b WHERE b."TenantId"=$1::uuid AND b."Id"=$2::uuid AND b."IsActive"',[auth.tenantId,auth.branchId]);
  const source=identity[0]?fleetSource(identity[0].neonBranch,process.env.VERCEL_ENV,identity[0].branchName):null;
  if(!source)throw new FleetError(503,"FLEET_SOURCE_UNVERIFIED","Origem do banco ou filial não confirmada. Nenhuma operação foi executada.");
  if(method!=="GET"&&!source.writable)throw new FleetError(403,"FLEET_MAIN_READ_ONLY","O banco principal está em modo somente leitura fora da produção. Acesse o endereço oficial para alterar dados.");
  let result:unknown,status=200;
  if(method==="GET"&&path.length===1&&path[0]==="overview")result={...await overview(auth),source};
  else if(method==="POST"&&path.length===1&&path[0]==="vehicles"){result=await registerVehicle(auth,await body(request),cid);status=201;}
  else if(method==="PATCH"&&path.length===2&&path[0]==="vehicles"){result=await editVehicle(auth,uuid(path[1]),await body(request),cid);}
  else if(method==="PATCH"&&path.length===3&&path[0]==="vehicles"&&path[2]==="odometer"){result=await correctOdometer(auth,uuid(path[1]),await body(request),cid);}
  else if(method==="POST"&&path.length===1&&path[0]==="trips"){result=await startTrip(auth,await body(request),cid);status=201;}
  else if(method==="PATCH"&&path.length===3&&path[0]==="trips"&&path[2]==="complete"){result=await finishTrip(auth,uuid(path[1]),await body(request),cid);}
  else throw new FleetError(404,"NOT_FOUND","Recurso não encontrado.");
  const response=json(result,status);response.headers.set("X-Correlation-Id",cid);return response;
 }catch(e){return issue(e,cid);}
}
export async function GET(r:NextRequest,c:RouteContext){return handle(r,c,"GET");}
export async function POST(r:NextRequest,c:RouteContext){return handle(r,c,"POST");}
export async function PATCH(r:NextRequest,c:RouteContext){return handle(r,c,"PATCH");}
