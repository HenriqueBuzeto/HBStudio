import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/neon-db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "HBStudioEnterpriseNeonDirectKey2026Secure!";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("hb_access_token")?.value;

  if (!token) {
    return NextResponse.json(
      { error: "Sessão não encontrada.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  try {
    // 1. Decodificar e validar JWT
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const userId = decoded.sub;

    const sql = getDb();

    // 2. Buscar dados atualizados do usuário no Neon
    const users = await sql.query(
      `SELECT "Id", "FullName", "Email", "IsActive", "DefaultBranchId", "TenantId", "JobTitle"
       FROM users 
       WHERE "Id" = $1 
       LIMIT 1;`,
      [userId]
    );

    if (users.length === 0 || !users[0].IsActive) {
      const res = NextResponse.json(
        { error: "Sessão inválida ou revogada.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
      res.cookies.set("hb_access_token", "", { maxAge: 0, path: "/" });
      return res;
    }

    const user = users[0];

    // 3. Buscar permissões atuais
    const permsRes = await sql.query(
      `SELECT DISTINCT rp."PermissionKey"
       FROM role_permissions rp
       JOIN user_roles ur ON rp."RoleId" = ur."RoleId"
       WHERE ur."UserId" = $1;`,
      [user.Id]
    );

    const permissions = permsRes.map((r: any) => r.PermissionKey);

    return NextResponse.json({
      user: {
        id: user.Id,
        fullName: user.FullName,
        email: user.Email,
        tenantId: user.TenantId,
        branchId: user.DefaultBranchId,
        isPartner: true,
        partnerRole: "ManagingPartner",
        permissions: permissions,
        jobTitle: user.JobTitle || "Colaborador",
      },
    });
  } catch (err) {
    const res = NextResponse.json(
      { error: "Sessão expirada ou inválida.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
    res.cookies.set("hb_access_token", "", { maxAge: 0, path: "/" });
    return res;
  }
}
