import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import crypto from "crypto";

// Legacy routes use db.query(sql, params); new routes use db(sql, params)
// and db.transaction([...]). Provide one compatible, typed client for all three.
export type ServerlessDb = NeonQueryFunction<false, false> & {
  query: (statement: string, params?: any[]) => Promise<any[]>;
};

export function getDb(): ServerlessDb {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL_NOT_CONFIGURED: A variável DATABASE_URL é obrigatória no ambiente da Vercel.");
  }

  const sql = neon(connectionString);
  return Object.assign(sql, {
    query: async (statement: string, params: any[] = []): Promise<any[]> => {
      // The Neon HTTP client is callable; it does not expose a pg-style query method.
      return await sql(statement, params);
    },
  });
}

// Hasher canônico compatível com o Pbkdf2PasswordHasher (.NET 10) do HB Studio ERP
export function verifyPbkdf2Password(password: string, storedHash: string): boolean {
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
