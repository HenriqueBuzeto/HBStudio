/**
 * Presentation masks for Brazilian business documents, phones and postal codes.
 * Canonical storage and API transport use digits only, except fields that
 * legitimately require letters (e.g. IE ISENTO, SKU, serial, ID).
 * Never coerce an incomplete number into a valid identifier.
 */
export const onlyDigits=(value:string|null|undefined):string=>String(value??"").replace(/\D/g,"");

const sections=(v:string,sizes:number[],separators:string[]):string=>{
 let out="",pos=0;
 for(let i=0;i<sizes.length&&pos<v.length;i++){
  const segment=v.slice(pos,pos+sizes[i]);if(!segment)break;
  if(i>0)out+=separators[i-1]||"";
  out+=segment;pos+=segment.length;
 }
 return out;
};
export function formatCpf(value:string|null|undefined):string {
 const v=onlyDigits(value).slice(0,11);
 return sections(v,[3,3,3,2],[".",".","-"]);
}
export function formatCnpj(value:string|null|undefined):string {
 const v=onlyDigits(value).slice(0,14);
 return sections(v,[2,3,3,4,2],[".",".","/","-"]);
}
export function formatCpfCnpj(value:string|null|undefined,kind?:1|2|"CPF"|"CNPJ"):string {
 const digits=onlyDigits(value);
 return kind===2||kind==="CNPJ"||(!kind&&digits.length>11)?formatCnpj(value):formatCpf(value);
}
export function formatCep(value:string|null|undefined):string {
 const v=onlyDigits(value).slice(0,8);
 return v.length>5?v.slice(0,5)+"-"+v.slice(5):v;
}
/** Local BR phone (10/11 digits), optional +55 prefix (12/13 digits).
 * Preserve other-country numbers rather than invent DDD or country code.
 */
export function formatPhoneBr(value:string|null|undefined):string {
 const original=String(value??"").trim();if(!original)return "";
 let digits=onlyDigits(original);
 const international=(original.startsWith("+55")||digits.length>=12&&digits.startsWith("55"));
 if(international)digits=digits.slice(2);
 if(digits.length!==10&&digits.length!==11) {
  if(digits.length>11)return original;
  const area=digits.slice(0,2);
  const local=digits.slice(2,11);
  const halfway=digits.length===11?5:4;
  const formatted=digits.length<=2?"("+area:("("+area+") "+local.slice(0,halfway)+(local.length>halfway?"-"+local.slice(halfway):""));
  return (international?"+55 ":"")+formatted;
 }
 const halfway=digits.length===11?5:4;
 return (international?"+55 ":"")+"("+digits.slice(0,2)+") "+
  digits.slice(2,2+halfway)+"-"+digits.slice(2+halfway);
}
export function maskPhoneInput(value:string):string {
 const digits=onlyDigits(value);
 // Do not silently truncate international numbers pasted into a local field.
 return formatPhoneBr(value.startsWith("+")?value:digits.slice(0,11));
}
export function normalizePhoneBr(value:string|null|undefined):string|null {
 const digits=onlyDigits(value);if(!digits)return null;
 const local=digits.startsWith("55")&&digits.length>=12?digits.slice(2):digits;
 return (local.length===10||local.length===11)?local:null;
}
export function normalizeDocument(value:string|null|undefined):string|null {
 const v=onlyDigits(value);return v||null;
}
export function normalizeCep(value:string|null|undefined):string|null {
 const v=onlyDigits(value);return v||null;
}
export function formatDateBr(value:string|null|undefined):string {
 if(!value)return "";
 // Date-only, ISO and server timestamps: avoid accidental timezone day shifts.
 const match=value.match(/^(\d{4})-(\d{2})-(\d{2})/);
 if(match)return match[3]+"/"+match[2]+"/"+match[1];
 return value;
}
