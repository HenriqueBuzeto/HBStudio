import {FleetError} from "@/lib/fleet-session";

export function digits(value:unknown):string {
 return typeof value==="string"?value.replace(/\D/g,""):"";
}
export function isValidCnpj(value:unknown):boolean {
 const v=digits(value);
 if(v.length!==14||/^(\d)\1{13}$/.test(v))return false;
 let base=v.slice(0,12);
 for(let length=12;length<=13;length++){
  let weight=length-7;let total=0;
  for(let i=0;i<length;i++){total+=Number(v[i])*weight;weight=weight===2?9:weight-1;}
  const remainder=total%11;
  const dv=remainder<2?0:11-remainder;
  if(dv!==Number(v[length]))return false;
  base+=String(dv);
 }
 return true;
}
export type FiscalEstablishmentInput={
 corporateName:string;tradeName:string;cnpj:string;stateRegistration:string;
 municipalRegistration:string;cnae:string;regime:number;environment:number;
 street:string;number:string;complement:string;neighborhood:string;
 cityName:string;cityCodeIbge:string;state:string;postalCode:string;
 nfceDefaultSeries:number;nfceNextNumber:number;
};
function required(v:unknown,label:string,max=150):string{
 if(typeof v!=="string"||!v.trim()||v.trim().length>max)throw new FleetError(400,"INVALID_FISCAL_FIELD",label+" obrigatório ou inválido.");
 return v.trim();
}
function optional(v:unknown,max=150):string{
 if(v===null||v===undefined||v==="")return "";
 if(typeof v!=="string"||v.trim().length>max)throw new FleetError(400,"INVALID_FISCAL_FIELD","Campo fiscal inválido.");
 return v.trim();
}
export function validateFiscalEstablishment(value:unknown):FiscalEstablishmentInput{
 if(!value||typeof value!=="object"||Array.isArray(value))throw new FleetError(400,"INVALID_JSON","Informe os dados fiscais.");
 const v=value as Record<string,unknown>;
 const cnpj=digits(v.cnpj);
 if(!isValidCnpj(cnpj))throw new FleetError(400,"INVALID_CNPJ","CNPJ inválido: verifique os dígitos verificadores.");
 const state=required(v.state,"UF",2).toUpperCase();
 if(state!=="SP")throw new FleetError(422,"UF_NOT_SUPPORTED","Neste módulo, a homologação fiscal está limitada a São Paulo.");
 const ie=digits(v.stateRegistration);
 if(ie.length!==12)throw new FleetError(400,"INVALID_IE","Inscrição Estadual SP deve ter 12 dígitos. Valide sua situação no CADESP.");
 const regime=Number(v.regime),env=Number(v.environment);
 if(![1,2,3].includes(regime))throw new FleetError(400,"INVALID_REGIME","Regime tributário inválido.");
 if(env!==2)throw new FleetError(409,"PRODUCTION_LOCKED","Produção fiscal está bloqueada até homologação externa da SEFAZ. Selecione homologação.");
 const cityCodeIbge=digits(v.cityCodeIbge),postalCode=digits(v.postalCode),cnae=digits(v.cnae);
 if(!/^35\d{5}$/.test(cityCodeIbge))throw new FleetError(400,"INVALID_CITY_IBGE","Informe código IBGE de município paulista com 7 dígitos.");
 if(!/^\d{8}$/.test(postalCode))throw new FleetError(400,"INVALID_POSTAL_CODE","CEP deve conter oito dígitos.");
 if(!/^\d{7}$/.test(cnae))throw new FleetError(400,"INVALID_CNAE","CNAE deve conter sete dígitos.");
 const series=Number(v.nfceDefaultSeries),nextNumber=Number(v.nfceNextNumber);
 if(!Number.isInteger(series)||series<0||series>999)throw new FleetError(400,"INVALID_NFCE_SERIES","Série fora do intervalo válido.");
 if(!Number.isInteger(nextNumber)||nextNumber<1||nextNumber>999999999)throw new FleetError(400,"INVALID_NFCE_NUMBER","Próximo número NFC-e inválido.");
 return {
  corporateName:required(v.corporateName,"Razão social",200),
  tradeName:optional(v.tradeName,200)||required(v.corporateName,"Razão social",200),
  cnpj,
  stateRegistration:ie,
  municipalRegistration:optional(v.municipalRegistration,40),
  cnae,regime,environment:env,
  street:required(v.street,"Logradouro",200),
  number:required(v.number,"Número do imóvel",40),
  complement:optional(v.complement,150),
  neighborhood:required(v.neighborhood,"Bairro",100),
  cityName:required(v.cityName,"Município",100),
  cityCodeIbge,
  state,postalCode,
  nfceDefaultSeries:series,nfceNextNumber:nextNumber
 };
}
