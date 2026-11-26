// Money is represented as integer cents. SQL remains the authority for writes.
export function parsePartnerCents(v:string):number{
 if(!/^\d{1,10}(?:[.,]\d{1,2})?$/.test(v.trim()))throw Error("Informe valores monetários válidos, com até duas casas decimais.");
 const [a,b=""]=v.trim().replace(",",".").split(".");const x=Number(a)*100+Number(b.padEnd(2,"0"));
 if(!Number.isSafeInteger(x)||x>100000000000)throw Error("Valor fora do limite.");return x;
}
export function splitPartnerPayment(amount:number,balances:{id:string;name:string;balance:number}[]){
 const rows=[...balances].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 if(!rows.length)return [];
 return rows.map((r,i)=>({...r,allocation:Math.min(Math.max(0,r.balance),Math.floor(amount/rows.length)+(i<amount%rows.length?1:0))}));
}
export function releaseMonthly(monthly:number,balance:number){return Math.max(0,monthly-Math.max(0,balance));}

type PaymentShare={investmentId:string;partnerId:string;name:string;balanceCents:number|string|null};
type PaymentInvestment={id:string;date:string;payableId:string|null};
type PaymentScope={source:string;date:string;investmentId:string;settlementId:string;partnerId:string;mode:string};
// Match the SQL command's historical share scope, including zero balances for collective division.
export function scopedPaymentShares<S extends PaymentShare>(shares:S[],investments:PaymentInvestment[],scope:PaymentScope):S[]{
 if(!scope.date||!["EXTERNAL","SETTLEMENT"].includes(scope.source)||(scope.source==="SETTLEMENT"&&(!scope.settlementId||!scope.investmentId)))return [];
 const byId=new Map(investments.map(i=>[i.id,i]));
 return shares.filter(s=>{
  const i=byId.get(s.investmentId);
  return !!i&&i.date<=scope.date&&(!scope.investmentId||i.id===scope.investmentId)&&(scope.mode!=="PERSONAL"||s.partnerId===scope.partnerId)&&(scope.source==="SETTLEMENT"?!!i.payableId:!i.payableId);
 });
}
export function partnerPaymentBalance(shares:PaymentShare[],partnerId:string):number{
 return shares.filter(s=>s.partnerId===partnerId).reduce((sum,s)=>sum+Math.max(0,Number(s.balanceCents)||0),0);
}
export function paymentCanConfirm(amount:number,allocated:number,mode:string,source:string,acceptPartial:boolean):boolean{
 return Number.isSafeInteger(amount)&&Number.isSafeInteger(allocated)&&amount>0&&allocated>0&&allocated<=amount&&(allocated===amount||(mode==="COLLECTIVE"&&source==="EXTERNAL"&&acceptPartial));
}
