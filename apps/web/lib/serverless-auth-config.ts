/**
 * Chave de assinatura das sessões serverless.
 *
 * Nunca use uma chave estática de desenvolvimento como fallback.
 * A mesma variável deve estar disponível nas rotas de login, /me e logout.
 */
export function requireJwtSessionSecret(): string {
  // Preserva a precedência existente para evitar incompatibilidade de sessões.
  const secret = process.env.JWT_SECRET || process.env.AUTH_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("AUTH_SECRET_NOT_CONFIGURED");
  }
  return secret;
}
