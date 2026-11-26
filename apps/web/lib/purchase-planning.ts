import {analyze,defaultPolicy,prioritize,type Insight,type Policy} from "./purchase-insights.ts";
export type Rule=Policy&{skuId:string; supplierId:string|null;min:number;multiple:number;max:number;version:number};
export type Supplier={id:string;name:string;configured:number|null;samples:number;days:number|null};
export type Metric={id:string;abc:"A"|"B"|"C"|null;gmroi:number|null;seasonal:number|null;months:number;costs:{supplierId:string;unitCost:number;received:string}[]};
export type Advanced={suppliers:Supplier[];metrics:Metric[]};
export function effectivePolicy(rule:Rule|undefined,supplier:Supplier|undefined){
 const measured=supplier&&supplier.samples>=3&&supplier.days!==null&&supplier.days>=0&&supplier.days<=90?Math.max(1,Math.ceil(supplier.days)):null;
 const configured=supplier&&Number.isInteger(supplier.configured)&&supplier.configured!>=1&&supplier.configured!<=90?supplier.configured:null;
 return {policy:{lead:measured??rule?.lead??configured??defaultPolicy.lead,coverage:rule?.coverage??defaultPolicy.coverage,safety:rule?.safety??defaultPolicy.safety},leadSource:measured!==null?"observed":rule?"rule":configured!==null?"supplier":"scenario"};
}
export function planningRows(rows:Insight[],rules:Rule[],advanced:Advanced){
 const rm=new Map(rules.map(r=>[r.skuId,r])),mm=new Map(advanced.metrics.map(m=>[m.id,m])),sm=new Map(advanced.suppliers.map(s=>[s.id,s]));
 return rows.map(r=>{const rule=rm.get(r.id),supplier=rule?.supplierId?sm.get(rule.supplierId):undefined,{policy,leadSource}=effectivePolicy(rule,supplier),a=analyze(r,policy),metric=mm.get(r.id);
 let quantity=a.quantity,state=a.state,reason=a.reason;
 // No quantitative purchase unless explicitly configured for this SKU.
 if(state==="buy"&&!rule){state="review";quantity=null;reason="Cadastre a regra de reposição deste SKU antes de recomendar quantidade.";}
 if(state==="buy"&&rule&&quantity!==null&&quantity>0){const minimum=Math.ceil(Math.max(quantity,rule.min)/rule.multiple)*rule.multiple;const max=Math.floor(rule.max/rule.multiple)*rule.multiple;quantity=Math.min(minimum,max);if(quantity<rule.min||quantity<=0){quantity=null;state="review";reason="Limites e múltiplos de compra incompatíveis.";}else if(quantity<minimum)reason+=" Quantidade limitada pelo máximo por pedido.";}
 return {...a,state,quantity,reason,policy,leadSource,ruleVersion:rule?.version??0,supplierId:rule?.supplierId??null,abc:metric?.abc??null,gmroi:metric?.gmroi??null,seasonal:metric?.seasonal??null,months:metric?.months??0,quotes:metric?.costs??[]};
 }).sort(prioritize);
}
export type PlanningRow=ReturnType<typeof planningRows>[number];
export function allocateBudget(rows:PlanningRow[],supplierId:string,budgetCents:number){
 if(!Number.isSafeInteger(budgetCents)||budgetCents<=0)return [];
 let remaining=budgetCents;
 const candidates=rows.filter(r=>r.state==="buy"&&(r.quantity??0)>0&&r.supplierId===supplierId&&r.profit!==null&&r.profit>0&&r.q30>0).flatMap(r=>{const quote=r.quotes.find(q=>q.supplierId===supplierId);const cost=quote?Math.round(quote.unitCost*100):0;return cost>0&&Number.isSafeInteger(cost)?[{r,cost,score:(r.profit!/r.q30)*100/cost,received:quote!.received}]:[];}).sort((a,b)=>Number(b.r.risk)-Number(a.r.risk)||b.score-a.score||a.r.id.localeCompare(b.r.id));
 const out:{id:string;quantity:number;unitCostCents:number;received:string}[]=[];
 // Allocate only whole suggested lots: avoids violating min or multiple.
 for(const x of candidates){const qty=x.r.quantity!;const total=qty*x.cost;if(Number.isSafeInteger(total)&&total<=remaining){out.push({id:x.r.id,quantity:qty,unitCostCents:x.cost,received:x.received});remaining-=total;}}
 return out;
}
