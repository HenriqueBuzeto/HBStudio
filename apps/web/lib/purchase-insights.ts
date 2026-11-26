export type Insight={id:string;sku:string;name:string;kind:number;serialized:boolean;physical:number|null;available:number|null;incoming:number;pending:number;q7:number;q30:number;q90:number;salesCount:number;conditions:number;lastSale:string|null;revenue:number|null;profit:number|null;capital:number|null;samples:number;avgDays:number|null;fastest:number|null;entered:string|null;sold:string|null;days:number|null;saleNumber:string|null;condition:number|null};
export type Policy={lead:number;coverage:number;safety:number};
export const defaultPolicy:Policy={lead:5,coverage:14,safety:3};
export function validPolicy(p:Policy){return Number.isInteger(p.lead)&&p.lead>=1&&p.lead<=90&&Number.isInteger(p.coverage)&&p.coverage>=1&&p.coverage<=90&&Number.isInteger(p.safety)&&p.safety>=0&&p.safety<=30;}
export function analyze(r:Insight,p:Policy){
 const demand=r.q30/30,coverage=r.available===null||demand<=0?null:Math.max(0,r.available)/demand;
 const fast=r.samples>0&&r.fastest!==null&&r.fastest<=7;
 const margin=r.revenue!==null&&r.revenue>0&&r.profit!==null?r.profit/r.revenue*100:null;
 const risk=coverage!==null&&coverage<=p.lead;
 const validStock=r.available!==null&&r.available>=0&&r.physical!==null&&r.physical>=r.available;
 const history=r.salesCount>=3&&r.q30>=3;
 let quantity:number|null=null,reason:string,state:"review"|"buy"|"watch"|"hold"|"insufficient"="insufficient";
 if(!validPolicy(p))reason="Revise os parâmetros de planejamento.";
 else if(!validStock)reason="Saldo não confirmado ou inconsistente; confira o Kardex.";
 else if(r.pending>0){state="hold";reason="Já existe pedido em elaboração ou aguardando aprovação. Revise antes de recomprar.";}
 else if(r.serialized){state=fast||risk?"review":"watch";reason=fast?"Unidade vendida em até sete dias. Avalie recompra por condição, capacidade e custo; não extrapole uma amostra isolada.":"Aparelho serializado: a quantidade exige avaliação da condição e do histórico individual.";}
 else if(!history){state=fast?"review":"insufficient";reason="Histórico insuficiente: mínimo de três vendas distintas em 90 dias e três unidades em 30 dias.";}
 else if(r.profit!==null&&r.profit<0){state="hold";reason="Margem bruta realizada negativa. Revise preço e custo antes da reposição.";}
 else{const target=Math.ceil(demand*(p.lead+p.coverage+p.safety));const reorder=Math.ceil(demand*(p.lead+p.safety));quantity=r.available!+r.incoming<=reorder?Math.max(0,Math.ceil(target-r.available!-r.incoming)):0;state=quantity>0?"buy":"watch";reason=quantity>0?"Estoque disponível e compras aprovadas abaixo do ponto de reposição. Quantidade calculada no cenário informado.":"Posição de estoque e compras aprovadas suficientes no cenário.";}
 return {...r,demand,coverage,margin,fast,risk,quantity,reason,state};
}
export type Analysis=ReturnType<typeof analyze>;
export function prioritize(a:Analysis,b:Analysis){const rank={buy:0,review:1,hold:2,watch:3,insufficient:4};return rank[a.state]-rank[b.state]||Number(b.risk)-Number(a.risk)||b.q30-a.q30||a.name.localeCompare(b.name,"pt-BR");}
