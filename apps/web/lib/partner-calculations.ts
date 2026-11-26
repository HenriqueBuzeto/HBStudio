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
