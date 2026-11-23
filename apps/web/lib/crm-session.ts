import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { getDb } from "@/lib/serverless-db";

type DbClient = ReturnType<typeof getDb>;

export class CrmApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export interface CrmSession {
  db: DbClient;
  userId: string;
  tenantId: string;
  branchId: string;
  actorEmail: string;
  permissions: string[];
}

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function requireUuid(value: unknown, name: string): string {
  if (!isUuid(value)) throw new CrmApiError(400, "VALIDATION_ERROR", name + " inválido.");
  return value;
}
export function requireString(value: unknown, name: string, max = 200): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new CrmApiError(400, "VALIDATION_ERROR", name + " obrigatório (máximo " + max + " caracteres).");
  }
  return value.trim();
}
export function optionalString(value: unknown, max = 2000): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > max)
    throw new CrmApiError(400, "VALIDATION_ERROR", "Texto inválido.");
  return value.trim() || null;
}
export function requireValue(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1000000000 || Math.round(n * 100) / 100 !== n)
    throw new CrmApiError(400, "VALIDATION_ERROR", "Valor monetário inválido.");
  return n;
}
export function optionalDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    throw new CrmApiError(400, "VALIDATION_ERROR", "Data inválida.");
  return new Date(value).toISOString();
}

export async function requireCrmSession(request: NextRequest, permission: "crm.view" | "crm.manage"): Promise<CrmSession> {
  const token = request.cookies.get("hb_access_token")?.value;
  if (!token) throw new CrmApiError(401, "UNAUTHORIZED", "Faça login para continuar.");
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new CrmApiError(503, "AUTH_CONFIG_ERROR", "Serviço de autenticação indisponível.");

  let claims: jwt.JwtPayload;
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"], issuer: "HBStudioErp", audience: "HBStudioErpClient",
    });
    if (typeof decoded === "string") throw new Error("invalid token");
    claims = decoded;
  } catch {
    throw new CrmApiError(401, "UNAUTHORIZED", "Sessão inválida ou expirada.");
  }

  const userId = requireUuid(claims.sub, "Usuário");
  const tenantId = requireUuid(claims.tenant_id, "Empresa");
  const branchId = requireUuid(claims.branch_id, "Filial");
  if (typeof claims.session_id !== "string" || !claims.session_id || claims.security_stamp === undefined) {
    throw new CrmApiError(401, "UNAUTHORIZED", "Sessão não reconhecida.");
  }

  const db = getDb();
  const auth = await db.query(
    'SELECT u."Id",u."Email",u."SecurityStamp",u."IsActive",' +
    ' EXISTS(SELECT 1 FROM revoked_sessions rs WHERE rs."SessionId"=$4) AS revoked,' +
    ' EXISTS(SELECT 1 FROM partners p WHERE p."TenantId"=u."TenantId" AND lower(p."Email")=lower(u."Email")' +
    ' AND p."Status"=1 AND p."IsErpAccessEnabled"=true) AS active_partner' +
    ' FROM users u WHERE u."Id"=$1::uuid AND u."TenantId"=$2::uuid AND u."DefaultBranchId"=$3::uuid LIMIT 1',
    [userId, tenantId, branchId, claims.session_id]
  );
  const user = auth[0];
  if (!user || !user.IsActive || user.revoked || !user.active_partner ||
      String(user.SecurityStamp) !== String(claims.security_stamp)) {
    throw new CrmApiError(401, "UNAUTHORIZED", "Sessão revogada ou sem acesso.");
  }

  const rows = await db.query(
    'SELECT DISTINCT rp."PermissionKey" AS permission FROM user_roles ur' +
    ' JOIN role_permissions rp ON rp."RoleId"=ur."RoleId" AND rp."TenantId"=ur."TenantId"' +
    ' WHERE ur."TenantId"=$1::uuid AND ur."UserId"=$2::uuid', [tenantId, userId]
  );
  const permissions = rows.map((r: any) => String(r.permission));
  if (!permissions.includes(permission)) throw new CrmApiError(403, "FORBIDDEN", "Permissão " + permission + " necessária.");
  return { db, tenantId, branchId, userId, actorEmail: user.Email, permissions };
}
