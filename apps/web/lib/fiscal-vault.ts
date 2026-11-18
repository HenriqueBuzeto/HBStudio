import crypto from "node:crypto";
import { FleetError } from "@/lib/fleet-session";

/**
 * Dedicated fiscally scoped encryption; NEVER derive this from AUTH_SECRET.
 * FISCAL_ENCRYPTION_KEY: 64 hex chars or base64-encoded 32 random bytes.
 * HBF1 format: prefix(4) | nonce(12) | GCM-tag(16) | ciphertext.
 *
 * Read-time integrity includes tenant, establishment, environment and purpose.
 * Keep the key in Vercel Environment Variables; don't commit or log it.
 */
const MAGIC = Buffer.from("HBF1", "ascii");

function getKey(): Buffer {
 const raw=process.env.FISCAL_ENCRYPTION_KEY;
 if(!raw)throw new FleetError(503,"FISCAL_KEY_NOT_CONFIGURED","Cofre fiscal indisponível: configure FISCAL_ENCRYPTION_KEY na Vercel.");
 let key:Buffer;
 if(/^[0-9a-f]{64}$/i.test(raw))key=Buffer.from(raw,"hex");
 else if(/^[a-zA-Z0-9+/]{43}=$/.test(raw))key=Buffer.from(raw,"base64");
 else throw new FleetError(503,"FISCAL_KEY_INVALID","Chave fiscal configurada incorretamente.");
 if(key.length!==32)throw new FleetError(503,"FISCAL_KEY_INVALID","A chave fiscal deve ter 32 bytes.");
 return key;
}

export function encryptFiscal(value:Buffer|string, tenantId:string,estId:string,environment:number,purpose:"csc"|"pfx"|"pfx-password"){
 const key=getKey();
 const nonce=crypto.randomBytes(12);
 const aad=Buffer.from(["HBF1",tenantId,estId,environment,purpose].join("|"),"utf8");
 const cipher=crypto.createCipheriv("aes-256-gcm",key,nonce);
 cipher.setAAD(aad);
 const source=Buffer.isBuffer(value)?value:Buffer.from(value,"utf8");
 const ct=Buffer.concat([cipher.update(source),cipher.final()]);
 return Buffer.concat([MAGIC,nonce,cipher.getAuthTag(),ct]);
}

export function decryptFiscal(value:Buffer, tenantId:string,estId:string,environment:number,purpose:"csc"|"pfx"|"pfx-password"){
 if(!Buffer.isBuffer(value)||value.length<32||!value.subarray(0,4).equals(MAGIC))
  throw new FleetError(409,"LEGACY_CREDENTIAL_FORMAT","Credencial legada não autenticada. Reimporte-a no cofre fiscal.");
 const key=getKey();
 const nonce=value.subarray(4,16),tag=value.subarray(16,32),ciphertext=value.subarray(32);
 const decipher=crypto.createDecipheriv("aes-256-gcm",key,nonce);
 decipher.setAAD(Buffer.from(["HBF1",tenantId,estId,environment,purpose].join("|"),"utf8"));
 decipher.setAuthTag(tag);
 try{return Buffer.concat([decipher.update(ciphertext),decipher.final()]);}
 catch{throw new FleetError(409,"CREDENTIAL_INTEGRITY_ERROR","Falha de integridade da credencial. Operação fiscal bloqueada.");}
}

export function isFiscalEncryptionConfigured():boolean{
 try{getKey();return true;}catch{return false;}
}
