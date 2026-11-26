import { NextRequest, NextResponse, connection } from "next/server";
import {authorizeFleet,FleetError} from "@/lib/fleet-session";

export async function GET(request:NextRequest){
 await connection();
 try{
  const ctx=await authorizeFleet(request,"access.manage");
  const rows=await ctx.db.query(`SELECT u."Id"::text id,u."FullName" "fullName",u."Email" email,u."JobTitle" "jobTitle",u."IsActive" "isActive",u."SecurityStamp" "securityStamp",u."CreatedAtUtc" "createdAtUtc",p."Id" IS NOT NULL "isPartner",CASE p."Type" WHEN 1 THEN 'Sócio administrador' WHEN 2 THEN 'Sócio operacional' WHEN 3 THEN 'Investidor' WHEN 4 THEN 'Conselheiro' END "partnerRole",coalesce(r.roles,ARRAY[]::text[]) roles FROM users u LEFT JOIN partner_user_links_v10 l ON l.tenant_id=u."TenantId" AND l.user_id=u."Id" LEFT JOIN partners p ON p."TenantId"=l.tenant_id AND p."Id"=l.partner_id LEFT JOIN LATERAL(SELECT array_agg(DISTINCT ro."Name"::text ORDER BY ro."Name"::text) roles FROM user_roles ur JOIN roles ro ON ro."TenantId"=ur."TenantId" AND ro."Id"=ur."RoleId" WHERE ur."TenantId"=u."TenantId" AND ur."UserId"=u."Id") r ON true WHERE u."TenantId"=$1::uuid ORDER BY u."FullName"`,[ctx.tenantId]);
  return NextResponse.json(rows,{headers:{"Cache-Control":"no-store"}});
 }catch(e){return NextResponse.json({error:e instanceof FleetError?e.message:"Cadastro de usuários indisponível."},{status:e instanceof FleetError?e.status:503,headers:{"Cache-Control":"no-store"}});}
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("hb_access_token")?.value;
  const apiUrl = process.env.API_INTERNAL_URL || "http://localhost:5021";

  if (!token) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const backendRes = await fetch(`${apiUrl}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch {
    return NextResponse.json({ error: "Erro ao criar usuário no servidor." }, { status: 503 });
  }
}
