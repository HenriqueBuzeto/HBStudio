import { neon } from "@neondatabase/serverless";
import crypto from "crypto";

// Conexão direta com Neon Serverless (compatível nativamente com Vercel Edge / Serverless)
export function getDb() {
  const connectionString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL ou POSTGRES_URL não configurada no ambiente da Vercel."
    );
  }

  return neon(connectionString);
}

// Verificador de senha compatível com PBKDF2-HMAC-SHA256 (formato v1.{iter}.{salt}.{hash} e bcrypt)
export function verifyPasswordPbkdf2(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;

  const parts = storedHash.split(".");
  let iterations = 600000;
  let saltBase64 = "";
  let hashBase64 = "";

  if (parts.length === 4 && parts[0] === "v1") {
    iterations = parseInt(parts[1], 10);
    saltBase64 = parts[2];
    hashBase64 = parts[3];
  } else if (parts.length === 3) {
    iterations = parseInt(parts[0], 10);
    saltBase64 = parts[1];
    hashBase64 = parts[2];
  } else {
    return false;
  }

  if (isNaN(iterations) || !saltBase64 || !hashBase64) return false;

  try {
    const salt = Buffer.from(saltBase64, "base64");
    const expectedHash = Buffer.from(hashBase64, "base64");
    const derivedKey = crypto.pbkdf2Sync(
      password,
      salt,
      iterations,
      expectedHash.length,
      "sha256"
    );

    return crypto.timingSafeEqual(expectedHash, derivedKey);
  } catch {
    return false;
  }
}
