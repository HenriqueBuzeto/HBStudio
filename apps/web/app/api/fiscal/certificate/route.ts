import {NextRequest,NextResponse} from "next/server";
import crypto,{X509Certificate} from "node:crypto";
import tls from "node:tls";
import {authorizeFleet,guardOrigin,FleetError} from "@/lib/fleet-session";
import {encryptFiscal} from "@/lib/fiscal-vault";

/**
 * Storage gate, NOT fiscal activation: checks the PFX password, leaf dates,
 * key/cert loading and certificate CNPJ. ICP-Brasil path/OCSP and real SEFAZ
 * homologation are not implemented here; IsActive stays false by design.
 */
export async function POST(request:NextRequest){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 let bytes:Buffer|undefined;
 try{
  guardOrigin(request);
  const session=await authorizeFleet(request,"fiscal.settings.manage");
  if(Number(request.headers.get("content-length")||0)>2_900_000)
   throw new FleetError(413,"CERT_TOO_LARGE","Certificado muito grande: limite 2 MB.");
  const value:unknown=await request.json().catch(()=>null);
  if(!value||typeof value!=="object"||Array.isArray(value))
   throw new FleetError(400,"INVALID_JSON","Dados do certificado inválidos.");
  const b=value as Record<string,unknown>;
  const base64=b.pfxBase64,pass=b.password;
  if(typeof base64!=="string"||base64.length<100||base64.length>2_800_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))
   throw new FleetError(400,"INVALID_PFX","Arquivo .pfx inválido ou excede o limite.");
  if(typeof pass!=="string"||pass.length<1||pass.length>250)
   throw new FleetError(400,"INVALID_PFX_PASSWORD","Senha do certificado não informada.");
  bytes=Buffer.from(base64,"base64");
  if(bytes.length<64||bytes.length>2_000_000)throw new FleetError(400,"INVALID_PFX","Arquivo PFX inválido.");
  const ests=await session.db.query(
   'SELECT "Id"::text AS id,"Cnpj" AS cnpj,"Environment" AS environment FROM fiscal_establishments WHERE "TenantId"=$1::uuid AND "BranchId"=$2::uuid AND "IsActive"=true LIMIT 1',
   [session.tenantId,session.branchId]
  );
  if(ests.length!==1)throw new FleetError(409,"ESTABLISHMENT_NOT_FOUND","Cadastre primeiro seu estabelecimento real.");
  const est=ests[0];const expected=String(est.cnpj).replace(/\D/g,"");const env=Number(est.environment);
  let leaf:X509Certificate;
  try{
   // Node/OpenSSL must decrypt the PKCS#12 and load a key matching the certificate.
   const context=tls.createSecureContext({pfx:bytes,passphrase:pass,minVersion:"TLSv1.2"});
   const cert=context.context.getCertificate();
   if(!cert)throw Error("missing-leaf");
   leaf=new X509Certificate(cert);
  }catch{
   throw new FleetError(422,"PFX_VALIDATION_FAILED","Não foi possível abrir o PFX. Verifique arquivo, senha e chave privada.");
  }
  const notBefore=new Date(leaf.validFrom),notAfter=new Date(leaf.validTo),now=Date.now();
  if(!Number.isFinite(notBefore.getTime())||!Number.isFinite(notAfter.getTime())||notBefore.getTime()>now||notAfter.getTime()<=now)
   throw new FleetError(422,"CERT_EXPIRED","Certificado digital fora do prazo real de validade.");
  if(leaf.subject===leaf.issuer)throw new FleetError(422,"CERT_UNTRUSTED","Certificado autoassinado não é aceito.");
  // Conservative: if the legal CNPJ is not extractable from the leaf's
  // subject, refuse rather than linking an unverified business identity.
  const subjectMatches=leaf.subject.match(/(?:^|\n)(?:CN|OU|O)=[^\n]*?([0-9]{14})(?=\D|$)/g)??[];
  const subjectCnpjs=subjectMatches.flatMap(m=>m.match(/[0-9]{14}/g)??[]);
  if(expected.length!==14||!subjectCnpjs.includes(expected))
   throw new FleetError(422,"CERT_CNPJ_UNVERIFIED","Não foi possível comprovar o CNPJ do estabelecimento no certificado A1. Revisão ICP-Brasil necessária.");
  const rawEncrypted=encryptFiscal(bytes,session.tenantId,String(est.id),env,"pfx");
  const passwordEncrypted=encryptFiscal(pass,session.tenantId,String(est.id),env,"pfx-password");
  const thumbprint=leaf.fingerprint.replaceAll(":","").toUpperCase();
  const id=crypto.randomUUID();
  const rows=await session.db.query(
   'WITH created AS (INSERT INTO fiscal_certificates ("Id","TenantId","EstablishmentId","SubjectName","Thumbprint","Cnpj","ValidFromUtc","ValidUntilUtc","EncryptedRawData","EncryptedPassword","KeyIvBase64","IsActive","CreatedAtUtc") VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7::timestamptz,$8::timestamptz,$9::bytea,$10::bytea,\'HBF1:AES-256-GCM\',false,now()) RETURNING "Id"),' +
   ' audit AS (INSERT INTO audit_events ("Id","TenantId","BranchId","EntityType","EntityId","Action","ActorId","ActorEmail","CorrelationId","AfterStateJson","CreatedAtUtc","Version") SELECT gen_random_uuid(),$2::uuid,$11::uuid,\'FiscalCertificate\',c."Id"::text,\'StoredPendingVerification\',$12::uuid,$13,$14,jsonb_build_object(\'thumbprint\',$5,\'validUntilUtc\',$8,\'isActive\',false),now(),1 FROM created c RETURNING "Id") SELECT c."Id"::text AS id FROM created c CROSS JOIN audit',
   [id,session.tenantId,est.id,leaf.subject,thumbprint,expected,notBefore.toISOString(),notAfter.toISOString(),rawEncrypted,passwordEncrypted,session.branchId,session.userId,session.email,cid]
  );
  if(rows.length!==1)throw new FleetError(409,"CERT_STORE_CONFLICT","Armazenamento do certificado não confirmado.");
  return NextResponse.json({stored:true,active:false,trustValidated:false,sefazValidated:false,thumbprint,validUntilUtc:notAfter.toISOString(),message:"PFX armazenado com criptografia autenticada; ainda não habilitado para emissão. Pendente validação ICP-Brasil e homologação SEFAZ."},{status:201,headers:{"Cache-Control":"no-store","X-Correlation-Id":cid}});
 }catch(error){
  if(error instanceof FleetError)return NextResponse.json({code:error.code,error:error.message},{status:error.status,headers:{"X-Correlation-Id":cid}});
  console.error("[FISCAL]["+cid+"] Certificate storage:",error instanceof Error?error.name:"Unknown");
  return NextResponse.json({code:"CERT_STORE_UNAVAILABLE",error:"Não foi possível armazenar o certificado com segurança."},{status:503,headers:{"X-Correlation-Id":cid}});
 }finally{bytes?.fill(0);}
}
