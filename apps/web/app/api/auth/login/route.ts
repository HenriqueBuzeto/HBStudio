import { NextRequest, NextResponse } from "next/server";
import { getDb, verifyPasswordPbkdf2 } from "@/lib/neon-db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "HBStudioEnterpriseNeonDirectKey2026Secure!";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Informe e-mail e senha." },
        { status: 400 }
      );
    }

    const sql = getDb();

    // 1. Busca direta na tabela users do Neon
    const users = await sql.query(
      `SELECT "Id", "FullName", "Email", "PasswordHash", "IsActive", "DefaultBranchId", "TenantId", "JobTitle"
       FROM users 
       WHERE LOWER("Email") = LOWER($1) 
       LIMIT 1;`,
      [email.trim()]
    );

    if (users.length === 0) {
      return NextResponse.json(
        { error: "Não foi possível entrar. Verifique suas credenciais ou procure o responsável pelo acesso." },
        { status: 401 }
      );
    }

    const user = users[0];

    if (!user.IsActive) {
      return NextResponse.json(
        { error: "Usuário inativo. Contate o administrador do sistema." },
        { status: 403 }
      );
    }

    // 2. Validação da senha criptografada via PBKDF2 (padrão OWASP gravado no Neon)
    const isPasswordValid = verifyPasswordPbkdf2(password, user.PasswordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Não foi possível entrar. Verifique suas credenciais ou procure o responsável pelo acesso." },
        { status: 401 }
      );
    }

    // 3. Buscar permissões reais do usuário no Neon
    const permsRes = await sql.query(
      `SELECT DISTINCT rp."PermissionKey"
       FROM role_permissions rp
       JOIN user_roles ur ON rp."RoleId" = ur."RoleId"
       WHERE ur."UserId" = $1;`,
      [user.Id]
    );

    const permissions = permsRes.map((r: any) => r.PermissionKey);

    const userPayload = {
      id: user.Id,
      fullName: user.FullName,
      email: user.Email,
      tenantId: user.TenantId,
      branchId: user.DefaultBranchId,
      isPartner: true,
      partnerRole: "ManagingPartner",
      permissions: permissions,
      jobTitle: user.JobTitle || "Colaborador",
    };

    // 4. Gerar JWT assinado
    const token = jwt.sign(
      {
        sub: user.Id,
        email: user.Email,
        tenant_id: user.TenantId,
        branch_id: user.DefaultBranchId,
        permissions: permissions,
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    const response = NextResponse.json({ user: userPayload });

    // 5. Configurar Cookie HttpOnly seguro para Vercel
    response.cookies.set("hb_access_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60, // 8 horas
    });

    return response;
  } catch (err: any) {
    console.error("Erro no login Neon:", err);
    return NextResponse.json(
      { error: "Não foi possível conectar ao banco de dados Neon. Tente novamente.", details: err.message },
      { status: 500 }
    );
  }
}
