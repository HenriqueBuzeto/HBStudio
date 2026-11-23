/**
 * All payment amounts are integer BRL centavos, merchant fees in basis points.
 * 100 bps = 1%. No interest is ever added to the customer's gross amount.
 */
export type FeeMethod="PIX"|"DEBIT"|"CREDIT";
export type FeeSettlementMode="SINGLE"|"MONTHLY";
export type AcquirerRate={
 method:FeeMethod;installments:number;mdrBps:number;anticipationBps:number;
 fixedFeeCents:number;settlementDays:number;settlementMode:FeeSettlementMode;enabled:boolean;
};
export type AcquirerFeeQuote={
 grossCents:number;mdrFeeCents:number;anticipationFeeCents:number;
 fixedFeeCents:number;feeTotalCents:number;netExpectedCents:number;
 customerInstallmentsCents:number[];merchantExpectedInstallmentsCents:number[];
 settlementMode:FeeSettlementMode;settlementDays:number;
};
const safeInt=(value:number,name:string)=>{
 if(!Number.isSafeInteger(value))throw new RangeError(name+" must be a safe integer");
};
function distribute(value:number,parts:number):number[]{
 safeInt(value,"value");safeInt(parts,"parts");
 if(value<0||parts<1||parts>18)throw new RangeError("Invalid distribution");
 const base=Math.floor(value/parts),remainder=value%parts;
 return Array.from({length:parts},(_,i)=>base+(i<remainder?1:0));
}
export function calculateAcquirerFee(grossCents:number,rate:AcquirerRate):AcquirerFeeQuote{
 safeInt(grossCents,"grossCents");
 if(grossCents<1||grossCents>100_000_000_000)throw new RangeError("Gross amount out of range");
 if(!["PIX","DEBIT","CREDIT"].includes(rate.method)||!rate.enabled)throw new RangeError("Method unavailable");
 for(const [key,v,max] of [
  ["installments",rate.installments,18],["mdrBps",rate.mdrBps,9999],
  ["anticipationBps",rate.anticipationBps,9999],
  ["fixedFeeCents",rate.fixedFeeCents,1_000_000],["settlementDays",rate.settlementDays,365]
 ] as const){safeInt(v,key);if(v<(key==="installments"?1:0)||v>max)throw new RangeError(key+" invalid");}
 if(rate.mdrBps+rate.anticipationBps>=10_000)throw new RangeError("Aggregate fees invalid");
 if(rate.method!=="CREDIT"&&rate.installments!==1)throw new RangeError("Only credit can be split");
 if(!["SINGLE","MONTHLY"].includes(rate.settlementMode)||
  (rate.settlementMode==="MONTHLY"&&rate.method!=="CREDIT"))
  throw new RangeError("Settlement mode invalid");
 // MDR on gross. Anticipation effective rate on gross minus MDR.
 // Provider-specific daily anticipation or installment fees require a separate pricing model.
 const mdrFeeCents=Math.round(grossCents*rate.mdrBps/10000);
 const afterMdr=grossCents-mdrFeeCents;
 const anticipationFeeCents=Math.round(afterMdr*rate.anticipationBps/10000);
 const netExpectedCents=afterMdr-anticipationFeeCents-rate.fixedFeeCents;
 if(netExpectedCents<0)throw new RangeError("Fees exceed transaction amount");
 const feeTotalCents=grossCents-netExpectedCents;
 return {
  grossCents,mdrFeeCents,anticipationFeeCents,fixedFeeCents:rate.fixedFeeCents,
  feeTotalCents,netExpectedCents,
  customerInstallmentsCents:distribute(grossCents,rate.installments),
  merchantExpectedInstallmentsCents:rate.settlementMode==="MONTHLY"?
   distribute(netExpectedCents,rate.installments):[netExpectedCents],
  settlementDays:rate.settlementDays,settlementMode:rate.settlementMode
 };
}
export function percentToBps(value:unknown,label:string):number{
 if(typeof value!=="number"&&typeof value!=="string")throw new RangeError(label+" invalid");
 const str=String(value).trim().replace(",",".");
 if(!/^(?:\d{1,2}|100)(?:\.\d{1,2})?$/.test(str))throw new RangeError(label+" invalid");
 const basis=Math.round(Number(str)*100);
 if(basis<0||basis>9999)throw new RangeError(label+" invalid");
 return basis;
}
export function currencyToCentsStrict(value:unknown,label:string):number{
 if(typeof value!=="number"&&typeof value!=="string")throw new RangeError(label+" invalid");
 const str=String(value).trim().replace(",",".");
 if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(str))throw new RangeError(label+" invalid");
 const cents=Math.round(Number(str)*100);
 if(!Number.isSafeInteger(cents)||cents>1_000_000)throw new RangeError(label+" out of range");
 return cents;
}
