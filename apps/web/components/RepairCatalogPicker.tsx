"use client";
import {useState} from "react";
export type RepairCatalogOption={id:string;name:string;skuCode:string;price:number;kind:number;available:number|null;serviceUnit:string|null;serviceMinutes:string|null};
export const repairMoney=(n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export default function RepairCatalogPicker({type,options,value,onChange,disabled=false}:{type:number;options:RepairCatalogOption[];value:string;onChange:(item:RepairCatalogOption|null)=>void;disabled?:boolean}){
 const [query,setQuery]=useState("");const normalized=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 const allowed=options.filter(x=>type===1?x.kind===4:x.kind!==4&&Number(x.available)>0);
 const selected=allowed.find(x=>x.id===value);
 const filtered=allowed.filter(x=>!query||normalized(x.name+" "+x.skuCode).includes(normalized(query)));
 const visible=selected&&!filtered.some(x=>x.id===selected.id)?[selected,...filtered]:filtered;
 return <div className="min-w-0 space-y-1.5"><input disabled={disabled} aria-label={type===1?"Buscar serviço":"Buscar peça ou produto"} className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs" placeholder={type===1?"Buscar serviço pelo nome ou código":"Buscar produto pelo nome ou SKU"} value={query} onChange={e=>setQuery(e.target.value)}/><select required disabled={disabled} aria-label={type===1?"Serviço do catálogo":"Produto disponível no estoque"} className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs" value={value} onChange={e=>onChange(allowed.find(x=>x.id===e.target.value)||null)}><option value="">Selecione {type===1?"um serviço":"uma peça ou produto"}</option>{visible.map(x=><option key={x.id} value={x.id}>{x.skuCode} · {x.name} · {repairMoney(x.price)}{type===2?" · Saldo "+x.available:""}</option>)}</select>
 {selected?<p className="text-[11px] text-slate-600">{type===1?(selected.serviceUnit==="HOUR"?"Cobrança por hora":"Cobrança por execução")+(Number(selected.serviceMinutes)>0?" · Duração prevista "+selected.serviceMinutes+" min":""):"Disponível na filial: "+selected.available+" un. · Sem reserva nesta etapa"}</p>:<p className="text-[11px] text-slate-500">{allowed.length===0?(type===1?"Nenhum serviço ativo disponível.":"Nenhum produto elegível com saldo na filial."):visible.length===0?"Nenhum resultado para esta busca.":"Selecione um item para preencher o preço."} {allowed.length===0&&<a href={type===1?"/catalog":"/inventory"} target="_blank" rel="noopener noreferrer" className="font-semibold text-violet-700 underline">Cadastrar {type===1?"serviço":"produto / saldo"}</a>}</p>}
 </div>;
}
