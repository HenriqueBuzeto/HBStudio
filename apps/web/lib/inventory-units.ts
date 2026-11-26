// Quantities remain in the canonical stock unit on the wire. Convert only for presentation.
export type StockUnitMetadata={gramsPerStockUnit?:number|null};
export type DisplayUnit="g"|"un"|"unknown";
const numberFormat=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:9});
const currencyFormat=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",minimumFractionDigits:2,maximumFractionDigits:4});
export function displayUnit(row:StockUnitMetadata):DisplayUnit{
 const f=row.gramsPerStockUnit;
 if(f===null)return "un";
 return typeof f==="number"&&Number.isFinite(f)&&f>0?"g":"unknown";
}
export function displayQuantity(value:number,row:StockUnitMetadata):number|null{
 const unit=displayUnit(row);if(unit==="unknown"||!Number.isFinite(value))return null;
 return unit==="g"?value*row.gramsPerStockUnit!:value;
}
export function formatStockQuantity(value:number,row:StockUnitMetadata,showPositiveSign=false):string{
 const amount=displayQuantity(value,row);if(amount===null||!Number.isFinite(amount))return "—";
 return (showPositiveSign&&amount>0?"+":"")+numberFormat.format(amount)+" "+displayUnit(row);
}
export function formatStockCost(cost:number|null|undefined,row:StockUnitMetadata):string{
 const unit=displayUnit(row);if(unit==="unknown"||cost==null||!Number.isFinite(cost))return "—";
 const normalized=unit==="g"?cost*1000/row.gramsPerStockUnit!:cost;
 return currencyFormat.format(normalized)+(unit==="g"?" / kg":" / un");
}
export function summarizeStock<T extends StockUnitMetadata>(rows:T[],quantity:(row:T)=>number):{unit:DisplayUnit;text:string}[]{
 const totals={g:0,un:0},present=new Set<DisplayUnit>();
 for(const row of rows){const unit=displayUnit(row),value=displayQuantity(quantity(row),row);if(unit==="unknown"||value===null||!Number.isFinite(value)){present.add("unknown");continue;}present.add(unit);totals[unit]+=value;}
 const result:{unit:DisplayUnit;text:string}[]=[];
 for(const unit of ["un","g"] as const)if(present.has(unit))result.push({unit,text:numberFormat.format(totals[unit])+" "+unit});
 if(present.has("unknown"))result.push({unit:"unknown",text:"Unidade não identificada"});
 return result;
}
