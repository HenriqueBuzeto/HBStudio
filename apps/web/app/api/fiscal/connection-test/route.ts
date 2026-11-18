import {NextRequest,NextResponse} from "next/server";
import crypto from "node:crypto";
import https from "node:https";
import {authorizeFleet,guardOrigin,FleetError} from "@/lib/fleet-session";
import {decryptFiscal} from "@/lib/fiscal-vault";

const HOMOLOGATION_URL="https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeStatusServico4.asmx";
const SOAP_ACTION="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF";

function bytea(v:unknown):Buffer{
 if(Buffer.isBuffer(v))return v;
 if(v instanceof Uint8Array)return Buffer.from(v);
 if(typeof v==="string"&&/^\\x[0-9a-f]+$/i.test(v))return Buffer.from(v.slice(2),"hex");
 if(typeof v==="string"&&/^[0-9a-f]+$/i.test(v))return Buffer.from(v,"hex");
 throw new FleetError(409,"ENCRYPTED_DATA_UNREADABLE","Formato de credencial desconhecido.");
}

async function statusSoap(pfx:Buffer,passphrase:string):Promise<{httpStatus:number;xml:string}>{
 const xml='<?xml version="1.0" encoding="utf-8"?>'+
 '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">'+
 '<soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">'+
 '<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">'+
 '<tpAmb>2</tpAmb><cUF>35</cUF><xServ>STATUS</xServ>'+
 '</consStatServ></nfeDadosMsg></soap12:Body></soap12:Envelope>';
 return new Promise((resolve,reject)=>{
  const req=https.request(HOMOLOGATION_URL,{
   method:"POST",pfx,passphrase,
   rejectUnauthorized:true,minVersion:"TLSv1.2",
   timeout:18000,maxHeaderSize:8192,
   headers:{"Content-Type":'application/soap+xml; charset=utf-8; action="'+SOAP_ACTION+'"',
    "Content-Length":Buffer.byteLength(xml,"utf8"),"Accept":"application/soap+xml"}
  },res=>{
   let size=0;const chunks:Buffer[]=[];
   res.on("data",(chunk:Buffer)=>{
    size+=chunk.length;
    if(size>150_000){res.destroy(new Error("XML_RESPONSE_TOO_LARGE"));return;}
    chunks.push(chunk);
   });
   res.on("end",()=>resolve({httpStatus:res.statusCode??0,xml:Buffer.concat(chunks).toString("utf8")}));
   res.on("error",reject);
  });
  req.on("timeout",()=>req.destroy(new Error("SEFAZ_TIMEOUT")));
  req.on("error",reject);
  req.end(xml);
 });
}

export async function POST(request:NextRequest){
 const cid=request.headers.get("x-correlation-id")||crypto.randomUUID();
 let raw:Buffer|undefined,password:Buffer|undefined;
 try{
  guardOrigin(request);
  const session=await authorizeFleet(request,"fiscal.settings.manage");
  const ests=await session.db.query('SELECT "Id"::text AS id,"Cnpj" AS cnpj,"Environment" AS environment FROM fiscal_establishments WHERE "TenantId"=$1::uuid AND "BranchId"=$2::uuid AND "IsActive"=true LIMIT 1',[session.tenantId,session.branchId]);
  if(ests.length!==1||Number(ests[0].environment)!==2)
   throw new FleetError(409,"FISCAL_HOMOLOGATION_REQUIRED","Teste permitido somente para estabelecimento de São Paulo em homologação.");
  const estId=String(ests[0].id);
  const certs=await session.db.query(
   'SELECT "Cnpj" AS cnpj,"KeyIvBase64" AS format,"EncryptedRawData" AS pfx,"EncryptedPassword" AS password,"ValidUntilUtc" AS expires FROM fiscal_certificates WHERE "TenantId"=$1::uuid AND "EstablishmentId"=$2::uuid AND "KeyIvBase64"=\'HBF1:AES-256-GCM\' ORDER BY "CreatedAtUtc" DESC LIMIT 1',
   [session.tenantId,estId]);
  if(certs.length!==1)throw new FleetError(409,"CERTIFICATE_PENDING","Certificado de homologação não encontrado no cofre fiscal.");
  if(String(certs[0].cnpj)!==String(ests[0].cnpj)||new Date(certs[0].expires).getTime()<=Date.now())
   throw new FleetError(409,"CERTIFICATE_MISMATCH","Certificado expirado ou incompatível com o CNPJ emitente.");
  raw=decryptFiscal(bytea(certs[0].pfx),session.tenantId,estId,2,"pfx");
  password=decryptFiscal(bytea(certs[0].password),session.tenantId,estId,2,"pfx-password");
  const response=await statusSoap(raw,password.toString("utf8"));
  // Fail closed: HTTP 200 is NOT a SEFAZ authorization or even an online status.
  if(response.httpStatus!==200)throw new FleetError(503,"SEFAZ_HTTP_ERROR","SEFAZ retornou erro HTTP "+response.httpStatus+". Não há autorização fiscal.");
  const body=response.xml.match(/<(?:[a-zA-Z0-9_-]+:)?retConsStatServ\b[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?retConsStatServ>/i)?.[1];
  const cStat=body?.match(/<(?:[a-zA-Z0-9_-]+:)?cStat>(\d+)<\/(?:[a-zA-Z0-9_-]+:)?cStat>/i)?.[1];
  const reason=body?.match(/<(?:[a-zA-Z0-9_-]+:)?xMotivo>([^<]{1,200})<\/(?:[a-zA-Z0-9_-]+:)?xMotivo>/i)?.[1];
  if(!cStat||!/^\d{3}$/.test(cStat))throw new FleetError(503,"SEFAZ_INVALID_RESPONSE","Resposta SEFAZ inválida ou protocolo SOAP incompatível. Nenhum documento foi emitido.");
  const online=Number(cStat)===107;
  return NextResponse.json({
   realSefazResponse:true,environment:"Homologação",service:"NFeStatusServico4",
   statusCode:Number(cStat),statusReason:reason??"Sem motivo informado",online,
   invoiceAuthorized:false,certificateFullyValidated:false,
   message:online?"SEFAZ respondeu ao teste de status. Emissão ainda não homologada.":"SEFAZ não declarou o serviço em operação. Emissão permanece bloqueada."
  },{headers:{"Cache-Control":"no-store","X-Correlation-Id":cid}});
 }catch(e){
  if(e instanceof FleetError)return NextResponse.json({code:e.code,error:e.message},{status:e.status,headers:{"Cache-Control":"no-store","X-Correlation-Id":cid}});
  console.error("[FISCAL]["+cid+"] SEFAZ connectivity:",e instanceof Error?e.name:"Unknown");
  return NextResponse.json({code:"SEFAZ_CONNECTION_FAILED",error:"Não foi possível consultar a SEFAZ em homologação com certificado válido. Verifique TLS, credenciamento e disponibilidade."},{status:503,headers:{"Cache-Control":"no-store","X-Correlation-Id":cid}});
 }finally{raw?.fill(0);password?.fill(0);}
}
