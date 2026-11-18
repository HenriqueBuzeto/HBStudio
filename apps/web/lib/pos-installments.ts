/**
 * Distributes a BRL total in integer centavos without losing cents.
 * The first installments receive any remainder. Works for 1x through 12x.
 * This is a quotation preview, not an acquiring-bank authorization or fee policy.
 */
export function distributeInstallments(totalCents: number, installments: number): number[] {
 if(!Number.isSafeInteger(totalCents)||totalCents<0)throw new RangeError("Invalid amount in cents");
 if(!Number.isInteger(installments)||installments<1||installments>12)throw new RangeError("Installments must be 1..12");
 const base=Math.floor(totalCents/installments);
 const remainder=totalCents%installments;
 return Array.from({length:installments},(_,i)=>base+(i<remainder?1:0));
}
export function currencyToCents(value:number):number{
 if(!Number.isFinite(value)||value<0||value>1_000_000_000)throw new RangeError("Invalid BRL amount");
 return Math.round(value*100);
}
