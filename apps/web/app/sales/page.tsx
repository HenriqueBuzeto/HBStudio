"use client";

import React,{useCallback,useEffect,useMemo,useRef,useState} from "react";
import RootShellLayout from "@/components/RootShellLayout";
import InternalCheckoutPanel from "./InternalCheckoutPanel";
import {useAuth} from "@/lib/auth";
import {distributeInstallments} from "@/lib/pos-installments";
import {formatCpfCnpj} from "@/lib/br-format";
import {buildPrintUrl,getBrowserPrintSettings} from "@/lib/browser-print";
import {ShoppingCart,Search,Plus,Minus,Trash2,Receipt,FileText,RefreshCw,
 CreditCard,Wallet,Banknote,QrCode,UserRound,Wrench,ShieldAlert,CheckCircle2,
 AlertTriangle,X,Printer,ScanBarcode,ChevronRight,Calculator,Info,Clock,Package,
 BadgeCheck,LockKeyhole,Percent,ClipboardList,ArrowRight} from "lucide-react";

type Product={id:string;skuCode:string;name:string;price:number;barcode:string|null;availableQuantity:number};
type Customer={id:string;name:string;document:string|null;points:null};
type Seller={id:string;name:string;jobTitle:string|null};
type Repair={id:string;orderNumber:string;defect:string;finalPrice:number;customerId:string;status:number};
type Quote={id:string;number:string;status:number;customerId:string|null;customer:string|null;sellerId:string;seller:string|null;validUntil:string;paymentTerms:string;discount:number;shipping:number;createdAt:string;subtotal:number;total:number;items:Array<{sku:string;description:string;quantity:number;price:number}>};
type Sale={id:string;saleNumber:string;status:number;paymentStatus:number;fulfillmentStatus:number;customerName:string;sellerName:string;subtotal:number;discountTotal:number;chargesTotal:number;totalAmount:number;createdAtUtc:string;items:Array<{skuCode:string;description:string;quantity:number;unitPrice:number}>;payments:Array<{method:number;amount:number;installments:number;status:number;reference:string|null}>;fiscalDocuments:Array<{status:number;accessKey:string;protocol:string|null;sefazStatus:number|null}>};
type TrainingSale={id:string;number:string;status:"SIMULATED"|"VOIDED";createdAt:string;totalCents:string;
 paymentMethod:string;installments:number;customer:string|null;seller:string|null};
type Cart={product:Product;quantity:number};
type Auxiliary={customers:Customer[];sellers:Seller[];products:Product[];repairs:Repair[];cashShift:null|{id:string;register:string;openedAt:string};fiscalReady:boolean;capabilities:{saveQuote:boolean;discountOverride:boolean;cancel:boolean;fiscalIssue:boolean;checkout:boolean}};
type Readiness={checks:Array<{code:string;ready:boolean;label:string;module:string}>;checkoutEnabled:boolean;checkoutBlocker:string;fiscalIssuanceReady:boolean;fiscalBlocker:string};
type MerchantFeePreview={
 configured:boolean;profiles:Array<{id:string;name:string;provider:string;version:number}>;
 selectedProfileId?:string;profileVersion?:number;customerInterestCents:number;
 quote?:{grossCents:number;mdrFeeCents:number;anticipationFeeCents:number;fixedFeeCents:number;netExpectedCents:number;feeTotalCents:number;settlementDays:number;settlementMode:string;merchantExpectedInstallmentsCents:number[]}|null;
 explanation?:string;disclaimer?:string;
};
type Method="Pix"|"CreditCard"|"DebitCard"|"Cash";
const money=(v:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
const cents=(v:number)=>Math.round(v*100);
const methodCode:Record<Method,number>={Cash:1,Pix:2,CreditCard:3,DebitCard:4};
const methodName:Record<Method,string>={Cash:"Dinheiro",Pix:"Pix",CreditCard:"Cartão de crédito",DebitCard:"Cartão de débito"};
const statusSale:Record<number,string>={1:"Rascunho",2:"Reservada",3:"Aguardando pagamento",4:"Confirmada",5:"Entregue",6:"Cancelada",7:"Devolução parcial",8:"Devolvida"};
const button="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-extrabold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45";
const primary="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 px-4 py-3 text-xs font-extrabold text-white shadow-md shadow-violet-200 transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40";
const field="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100";
const pill="rounded-lg bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-700";
function dateText(value:string){const dt=new Date(value);return Number.isFinite(dt.valueOf())?dt.toLocaleDateString("pt-BR"):"—";}
async function api<T>(url:string,method:"GET"|"POST"="GET",body?:unknown):Promise<T>{
 const res=await fetch(url,{method,cache:"no-store",credentials:"same-origin",headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});
 const result=await res.json().catch(()=>({error:"O servidor retornou uma resposta inválida."}));
 if(!res.ok)throw new Error((result.error||"Operação indisponível.")+" (HTTP "+res.status+")");
 return result as T;
}
function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}){
 return <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm" onMouseDown={e=>{if(e.currentTarget===e.target)onClose();}}>
 <section role="dialog" aria-modal="true" aria-label={title} className="my-auto max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
 <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4"><h2 className="font-black text-slate-900">{title}</h2><button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4"/></button></div>
 <div className="p-5">{children}</div></section></div>;
}

export default function SalesPage(){
 const {user,isLoading:authLoading,hasPermission}=useAuth();
 const permitted=hasPermission("sales.pos.use");
 const canSeeMerchantFees=hasPermission("sales.cost.view")||hasPermission("finance.reports.view");
 const [tab,setTab]=useState<"pos"|"internal"|"quotes"|"history"|"training">("pos");
 const [aux,setAux]=useState<Auxiliary>({customers:[],sellers:[],products:[],repairs:[],cashShift:null,fiscalReady:false,capabilities:{saveQuote:false,discountOverride:false,cancel:false,fiscalIssue:false,checkout:false}});
 const [quotes,setQuotes]=useState<Quote[]>([]),[history,setHistory]=useState<Sale[]>([]);
 const [trainingSales,setTrainingSales]=useState<TrainingSale[]>([]),[trainingMode,setTrainingMode]=useState(false);
 const [trainingLastUrl,setTrainingLastUrl]=useState("");
 const [qaCheckout,setQaCheckout]=useState(false);
 const [internalChecked,setInternalChecked]=useState(false),[showCatalog,setShowCatalog]=useState(false),[confirmClear,setConfirmClear]=useState(false);
 const deepLinkHandled=useRef(false);
 const internalAvailability=useCallback((enabled:boolean)=>{setQaCheckout(enabled);setInternalChecked(true);if(enabled&&!deepLinkHandled.current&&new URLSearchParams(window.location.search).has("factoryOrderId")){deepLinkHandled.current=true;setTab("internal");}},[]);
 const trainingRequestKey=useRef<string|null>(null);
 const [readiness,setReadiness]=useState<Readiness|null>(null);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [customerId,setCustomerId]=useState(""),[sellerId,setSellerId]=useState(""),[cpf,setCpf]=useState("");
 const [items,setItems]=useState<Cart[]>([]),[query,setQuery]=useState("");
 const [discountMode,setDiscountMode]=useState<"value"|"percent">("value"),[discountInput,setDiscountInput]=useState("");
 const [method,setMethod]=useState<Method>("Pix"),[installments,setInstallments]=useState(1),[cashReceived,setCashReceived]=useState("");
 const [acquirerId,setAcquirerId]=useState("");
 const [merchantFees,setMerchantFees]=useState<MerchantFeePreview|null>(null);
 const [merchantFeeLoading,setMerchantFeeLoading]=useState(false);
 const [merchantFeeError,setMerchantFeeError]=useState("");
 const [selectedQuote,setSelectedQuote]=useState<Quote|null>(null),[selectedSale,setSelectedSale]=useState<Sale|null>(null);
 const [printRetryUrl,setPrintRetryUrl]=useState("");
 const [repairId,setRepairId]=useState("");
 const [documentMode,setDocumentMode]=useState<"FISCAL"|"INTERNAL">("FISCAL");
 const [documentModeError,setDocumentModeError]=useState("");
 const [checkingDocumentMode,setCheckingDocumentMode]=useState(false);
 const [fiscalRequested,setFiscalRequested]=useState(false);
 const searchRef=useRef<HTMLInputElement|null>(null);
 const load=useCallback(async()=>{
  if(!permitted){setLoading(false);return;}
  setLoading(true);setError("");
  try{
   const [a,q,s,r,t]=await Promise.all([api<Auxiliary>("/api/sales/auxiliary"),api<{quotes:Quote[]}>("/api/sales/quotes"),api<{sales:Sale[]}>("/api/sales"),api<Readiness>("/api/sales/readiness").catch(()=>null),api<{sales:TrainingSale[]}>("/api/sales/training").catch(()=>({sales:[]}))]);
   setAux(a);setQuotes(q.quotes);setHistory(s.sales);setReadiness(r);setTrainingSales(t.sales);
   setSellerId(old=>a.sellers.some(x=>x.id===old)?old:(a.sellers.find(x=>x.id===user?.id)?.id||""));
  }catch(e){setError(e instanceof Error?e.message:"Falha ao consultar o Neon.");}
  finally{setLoading(false);}
 },[permitted,user?.id]);
 useEffect(()=>{if(!authLoading)void load();},[authLoading,load]);
 const toggleDocumentMode=useCallback(async()=>{
  if(checkingDocumentMode)return;
  if(documentMode==="INTERNAL"){
   setDocumentMode("FISCAL");setDocumentModeError("");return;
  }
  setCheckingDocumentMode(true);setDocumentModeError("");
  try{
   const response=await fetch("/api/sales/document-eligibility?"+
    new URLSearchParams({customerId,operationType:"LOCAL_GOODS",fiscalRequested:String(fiscalRequested)}),
    {cache:"no-store"});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||"Política fiscal indisponível.");
   if(!data.eligible){
    setDocumentMode("FISCAL");
    setDocumentModeError(data.explanation||"A operação não está autorizada a utilizar comprovante interno.");
    return;
   }
   setDocumentMode("INTERNAL");
  }catch(e){
   setDocumentMode("FISCAL");
   setDocumentModeError(e instanceof Error?e.message:"Não foi possível validar a situação fiscal.");
  }finally{setCheckingDocumentMode(false);}
 },[checkingDocumentMode,documentMode,customerId,fiscalRequested]);
 useEffect(()=>{
  const handler=(event:KeyboardEvent)=>{
   if(tab==="pos"&&!qaCheckout&&event.ctrlKey&&!event.altKey&&!event.shiftKey&&event.key==="F1"){
    event.preventDefault();setTrainingMode(v=>!v);setError("");
   }else if(tab==="pos"&&event.key==="F2"&&!event.ctrlKey&&!event.altKey&&!event.shiftKey&&!event.metaKey&&!selectedQuote&&!selectedSale&&!confirmClear){event.preventDefault();searchRef.current?.focus();
   }
  };
  window.addEventListener("keydown",handler);
  return ()=>window.removeEventListener("keydown",handler);
 },[qaCheckout,tab,selectedQuote,selectedSale,confirmClear]);

 useEffect(()=>{setDocumentMode("FISCAL");setDocumentModeError("");},[customerId,fiscalRequested,items.length]);
  const customer=aux.customers.find(x=>x.id===customerId);
 const match=useMemo(()=>{
  const s=query.trim().toLocaleLowerCase("pt-BR");
  if(s.length<2)return [];
  return aux.products.filter(p=>[p.name,p.skuCode,p.barcode||""].some(x=>x.toLocaleLowerCase("pt-BR").includes(s))).slice(0,20);
 },[aux.products,query]);
 const subtotalCents=items.reduce((v,i)=>v+cents(i.product.price)*i.quantity,0);
 const requestedDiscount=Number(discountInput||0);
 const maxDiscount=discountMode==="percent"?(subtotalCents*Math.min(Math.max(requestedDiscount,0),100)/100):cents(Math.max(requestedDiscount,0));
 const discountCents=Math.min(subtotalCents,Math.round(maxDiscount));
 const totalCents=Math.max(0,subtotalCents-discountCents);
 const total=totalCents/100;
 const paymentMethod=method==="Pix"?"PIX":method==="DebitCard"?"DEBIT":method==="CreditCard"?"CREDIT":null;
 useEffect(()=>{
  if(!permitted||!canSeeMerchantFees||!paymentMethod||totalCents<=0){
   setMerchantFees(null);setMerchantFeeError("");setMerchantFeeLoading(false);return;
  }
  const controller=new AbortController();
  setMerchantFeeLoading(true);setMerchantFeeError("");
  const params=new URLSearchParams({method:paymentMethod,installments:String(paymentMethod==="CREDIT"?installments:1),
    grossCents:String(totalCents)});
  if(acquirerId)params.set("profileId",acquirerId);
  fetch("/api/sales/acquirer-fees?"+params,{cache:"no-store",signal:controller.signal})
    .then(async res=>{
     const payload=await res.json().catch(()=>({}));
     if(!res.ok)throw new Error(payload.error||"Não foi possível consultar a taxa contratada.");
     if(!controller.signal.aborted)setMerchantFees(payload as MerchantFeePreview);
    })
    .catch(err=>{if(!controller.signal.aborted){
     setMerchantFees(null);setMerchantFeeError(err instanceof Error?err.message:"Taxas indisponíveis.");
    }})
    .finally(()=>{if(!controller.signal.aborted)setMerchantFeeLoading(false);});
  return ()=>controller.abort();
 },[permitted,canSeeMerchantFees,paymentMethod,installments,totalCents,acquirerId]);

 const selectedParts=distributeInstallments(totalCents,method==="CreditCard"?installments:1);
 const visibleParts=distributeInstallments(totalCents,installments);
 const change=Math.max(0,cents(Number(cashReceived||0))-totalCents)/100;
 const isDiscountValid=Number.isFinite(requestedDiscount)&&requestedDiscount>=0&&(discountMode!=="percent"||requestedDiscount<=100)&&maxDiscount<=subtotalCents;
 const canQuote=permitted&&aux.capabilities.saveQuote&&hasPermission("sales.create")&&items.length>0&&!!sellerId&&totalCents>0&&isDiscountValid&&(discountCents===0||aux.capabilities.discountOverride);
 const addProduct=(p:Product)=>{
  setItems(prev=>{const found=prev.find(x=>x.product.id===p.id);return found?prev.map(x=>x.product.id===p.id?{...x,quantity:Math.min(100,x.quantity+1)}:x):[...prev,{product:p,quantity:1}];});
  setQuery("");searchRef.current?.focus();
 };
 const qty=(id:string,d:number)=>setItems(prev=>prev.map(x=>x.product.id===id?{...x,quantity:Math.min(100,Math.max(0,x.quantity+d))}:x).filter(x=>x.quantity>0));
 const onScan=(e:React.KeyboardEvent<HTMLInputElement>)=>{
  if(e.key!=="Enter")return;
  e.preventDefault();
  const q=query.trim().toLowerCase();
  const matched=aux.products.find(p=>p.skuCode.toLowerCase()===q||p.barcode?.toLowerCase()===q);
  if(matched)addProduct(matched);
  else setError("Código não encontrado no catálogo da sua empresa. Selecione um resultado da busca.");
 };
 const saveTraining=async()=>{
  if(!trainingMode||!permitted||!items.length||!sellerId||totalCents<=0||
    !isDiscountValid||saving||(discountCents>0&&!aux.capabilities.discountOverride))return;
  const prefs=getBrowserPrintSettings();
  const printTab=prefs.autoPrintSale?window.open("about:blank","_blank"):null;
  const key=trainingRequestKey.current||crypto.randomUUID();
  trainingRequestKey.current=key;
  setSaving(true);setError("");setNotice("");setTrainingLastUrl("");
  try{
   const saved=await api<{id:string;number:string}>("/api/sales/training","POST",{
    requestKey:key,customerId:customerId||null,sellerId,
    items:items.map(i=>({skuId:i.product.id,quantity:i.quantity})),
    paymentMethod:method==="Cash"?"CASH":method==="Pix"?"PIX":method==="CreditCard"?"CREDIT":"DEBIT",
    installments:method==="CreditCard"?installments:1,discountCents
   });
   trainingRequestKey.current=null;
   const url=buildPrintUrl("training-sale",saved.id,prefs.paper,prefs.autoPrintSale);
   setTrainingLastUrl(url);
   setNotice("SIMULAÇÃO "+saved.number+" salva. Não existe venda real, recebimento, baixa de estoque ou nota.");
   if(printTab&&!printTab.closed)try{printTab.location.replace(new URL(url,window.location.origin).href);}catch{}
   setItems([]);setDiscountInput("");setTab("training");
   const refreshed=await api<{sales:TrainingSale[]}>("/api/sales/training");setTrainingSales(refreshed.sales);
  }catch(e){if(printTab&&!printTab.closed)printTab.close();setError(e instanceof Error?e.message:"Falha ao registrar simulação.");}
  finally{setSaving(false);}
 };
 const voidTraining=async(id:string)=>{
  if(!hasPermission("sales.cancel")){setError("Permissão sales.cancel necessária.");return;}
  const reason=window.prompt("Motivo do cancelamento da simulação:");
  if(reason===null)return;
  try{
   const res=await fetch("/api/sales/training/"+encodeURIComponent(id),{method:"PATCH",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({reason})});
   const data=await res.json().catch(()=>({}));
   if(!res.ok)throw new Error(data.error||"Falha ao cancelar.");
   const refreshed=await api<{sales:TrainingSale[]}>("/api/sales/training");
   setTrainingSales(refreshed.sales);setNotice("Simulação cancelada. Nenhum estorno financeiro foi gerado.");
  }catch(e){setError(e instanceof Error?e.message:"Falha ao cancelar.");}
 };
 const saveQuote=async()=>{
  if(!canQuote||saving)return;
  const prefs=getBrowserPrintSettings();
  // Reserve a tab synchronously during the click: browsers often block windows
  // opened asynchronously after the network request has completed.
  const pendingPrint=prefs.autoPrintQuote?window.open("about:blank","_blank"):null;
  setPrintRetryUrl("");
  setSaving(true);setError("");setNotice("");
  try{
   const paymentTerms=method==="CreditCard"?
    ("Crédito "+installments+"x sem juros ("+
      Array.from(new Set(selectedParts)).map(value=>
       selectedParts.filter(v=>v===value).length+"x de "+money(value/100)).join(" + ")+")")
    :methodName[method]+" à vista";
   const response=await api<{quote:{id:string;number:string};message:string}>("/api/sales/quotes","POST",{
    customerId:customerId||null,sellerId,items:items.map(x=>({id:x.product.id,quantity:x.quantity,expectedPriceCents:cents(x.product.price)})),
    discountCents,method:methodCode[method],installments:method==="CreditCard"?installments:1,
    paymentTerms,
   });
   setNotice("Orçamento "+response.quote.number+" salvo no Neon. Nenhum pagamento, estoque ou NFC-e foi movimentado.");
   if(prefs.autoPrintQuote){
    const printUrl=buildPrintUrl("quote",response.quote.id,prefs.paper,true);
    setPrintRetryUrl(printUrl);
    if(pendingPrint&&!pendingPrint.closed){
      try{pendingPrint.location.replace(new URL(printUrl,window.location.origin).href);}
      catch{setNotice("Orçamento salvo, mas a janela de impressão foi bloqueada. Utilize Imprimir agora.");}
    }else{
      setNotice("Orçamento salvo. O navegador bloqueou a impressão automática; use Imprimir agora.");
    }
   }
   setItems([]);setDiscountInput("");setQuery("");setRepairId("");setTab("quotes");
   const [a,q,s,r]=await Promise.all([api<Auxiliary>("/api/sales/auxiliary"),api<{quotes:Quote[]}>("/api/sales/quotes"),api<{sales:Sale[]}>("/api/sales"),api<Readiness>("/api/sales/readiness").catch(()=>null)]);
   setAux(a);setQuotes(q.quotes);setHistory(s.sales);setReadiness(r);
  }catch(e){if(pendingPrint&&!pendingPrint.closed)pendingPrint.close();setError(e instanceof Error?e.message:"Orçamento não foi salvo.");}
  finally{setSaving(false);}
 };
 return <RootShellLayout><style>{`@media print { body * { visibility: hidden !important; } #quote-print, #quote-print * { visibility: visible !important; } #quote-print { position: fixed !important; inset: 0 auto auto 0 !important; width: 100% !important; padding: 24px !important; background: white !important; box-shadow: none !important; border: 0 !important; } .no-print { display: none !important; } }`}</style><div className="space-y-4 pb-8">
  <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
   <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
    <div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700"><ShoppingCart className="h-5 w-5"/></span><div><p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Operações comerciais</p><h1 className="text-xl font-black tracking-tight text-slate-900">Frente de caixa</h1><p className="mt-0.5 text-xs text-slate-500">Atendimento, orçamentos e vendas.</p></div></div>
    <div className="flex flex-wrap items-center gap-2"><a href="/cash" className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"><span className={"h-2 w-2 rounded-full "+(aux.cashShift?"bg-emerald-500":"bg-amber-500")}/>{loading?"Consultando turno":aux.cashShift?"Caixa aberto · "+aux.cashShift.register:"Caixa sem turno"}<ChevronRight className="h-3 w-3"/></a><button className={button} onClick={()=>void load()} disabled={loading||saving}><RefreshCw className={"h-4 w-4 "+(loading?"animate-spin":"")}/> Atualizar</button></div>
   </div>
   <nav aria-label="Áreas do PDV" className="flex flex-wrap items-center gap-1 border-t border-slate-100 bg-slate-50/70 px-4 py-2">
    {([{id:"pos",label:"Atendimento",icon:ShoppingCart},{id:"internal",label:"Venda interna",icon:Banknote},{id:"quotes",label:"Orçamentos",icon:FileText,count:quotes.length},{id:"history",label:"Vendas",icon:Receipt,count:history.length},{id:"training",label:"Treinamento",icon:ClipboardList,count:trainingSales.length}] as const).filter(t=>t.id!=="internal"||qaCheckout||tab==="internal").map(t=><button key={t.id} type="button" aria-pressed={tab===t.id} onClick={()=>setTab(t.id)} className={"flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-violet-500 "+(tab===t.id?"bg-violet-700 text-white shadow-sm":"text-slate-600 hover:bg-white hover:text-violet-700")}><t.icon className="h-4 w-4"/>{t.label}{"count" in t&&<span className={"rounded-md px-1.5 py-0.5 text-[10px] tabular-nums "+(tab===t.id?"bg-white/20":"bg-slate-200/70")}>{t.count}</span>}</button>)}
   </nav>
  </header>
  {tab==="pos"&&trainingMode&&!qaCheckout&&<div role="status" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-800">Treinamento ativo — a simulação não registra venda real.</div>}
  {(error||notice)&&<div role="alert" className={"flex items-start gap-2 rounded-xl border px-4 py-3 text-xs font-semibold "+(error?"border-rose-200 bg-rose-50 text-rose-700":"border-emerald-200 bg-emerald-50 text-emerald-700")}>{error?<AlertTriangle className="h-4 w-4 shrink-0"/>:<CheckCircle2 className="h-4 w-4 shrink-0"/>}<span>{error||notice}</span><button type="button" className="ml-auto" onClick={()=>{setError("");setNotice("");}} aria-label="Fechar alerta"><X className="h-4 w-4"/></button></div>}
  {printRetryUrl&&<div role="status" className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs font-bold text-violet-800">
    <Printer className="h-4 w-4"/><span>Orçamento salvo. A impressão não é garantia de papel emitido.</span>
    <a href={printRetryUrl} target="_blank" rel="noopener noreferrer" className="ml-auto rounded-lg bg-violet-700 px-3 py-2 text-white">Abrir / imprimir novamente</a>
  </div>}
  {!authLoading&&!permitted?<div className="rounded-xl bg-white p-12 text-center text-sm text-slate-500">Acesso negado. Permissão <strong>sales.pos.use</strong> necessária.</div>
  :loading?<div className="rounded-xl bg-white p-16 text-center text-sm text-slate-500"><RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin"/>Consultando o Neon...</div>
  :tab==="internal"?<>{!qaCheckout&&<div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{internalChecked?"Venda interna indisponível nesta sessão.":"Verificando disponibilidade..."}</div>}</>:tab==="pos"?<div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,390px)] 2xl:grid-cols-[minmax(0,1fr)_420px]">
   <div className="min-w-0 space-y-4">
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
     <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-xs font-black text-slate-900"><ScanBarcode className="h-4 w-4 text-violet-600"/> Adicionar produtos</h2><span className={pill}>{aux.products.length} SKUs reais</span></div>
     <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input ref={searchRef} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={onScan} aria-label="Buscar produto, SKU ou código de barras" className={field+" min-h-11 pl-10 pr-12 text-sm"} placeholder="Digite ou bipe um código..."/><kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-500">F2</kbd></div>
     {!query.trim()&&<button type="button" aria-expanded={showCatalog} className="mt-3 flex items-center gap-2 text-xs font-bold text-violet-700" onClick={()=>setShowCatalog(v=>!v)}><Package className="h-4 w-4"/>{showCatalog?"Recolher catálogo":"Consultar catálogo"}</button>}
     {(query.trim().length>1||(!query.trim()&&showCatalog))&&<div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white">
      {(query.trim()?match:aux.products).length===0?<div className="p-4 text-xs text-slate-500">Nenhum produto encontrado neste catálogo.</div>:(query.trim()?match:aux.products).map(p=><button type="button" key={p.id} onClick={()=>addProduct(p)} className="flex w-full items-center justify-between gap-3 border-b border-slate-100 p-3 text-left hover:bg-violet-50">
       <div><strong className="block text-xs text-slate-800">{p.name}</strong><span className="text-[10px] text-slate-500">{p.skuCode} • Disponível: {p.availableQuantity}</span></div><span className="flex shrink-0 items-center gap-3 text-xs font-black text-violet-700">{money(p.price)}<Plus className="h-4 w-4"/></span>
      </button>)}
     </div>}
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
     <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3"><h2 className="flex items-center gap-2 text-xs font-black text-slate-900"><ShoppingCart className="h-4 w-4 text-violet-600"/> Carrinho <span className="rounded-md bg-violet-50 px-2 py-1 text-[10px] text-violet-700">{items.reduce((s,x)=>s+x.quantity,0)} itens</span></h2>{items.length>0&&<button type="button" className="text-xs font-bold text-rose-600" onClick={()=>setConfirmClear(true)}>Limpar carrinho</button>}</div>
     {items.length===0?<div className="flex min-h-[180px] flex-col items-center justify-center gap-2 p-8 text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400"><ShoppingCart className="h-7 w-7"/></span><strong className="text-sm text-slate-700">Comece um atendimento</strong><p className="max-w-[270px] text-xs leading-relaxed text-slate-500">Bipe o código de barras ou selecione um produto do catálogo.</p><button type="button" className="text-xs font-bold text-violet-700" onClick={()=>searchRef.current?.focus()}>Buscar produto</button></div>
     :<div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">{items.map(it=><div key={it.product.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400"><Package className="h-4 w-4"/></div><div className="min-w-[130px] flex-1"><h3 className="text-xs font-bold text-slate-900">{it.product.name}</h3><p className="mt-1 text-[10px] text-slate-500">{it.product.skuCode} • {money(it.product.price)}/un.</p>{it.quantity>it.product.availableQuantity&&<p className="mt-1 text-[10px] font-semibold text-amber-700">Sem saldo suficiente para venda imediata. Orçamento não reserva estoque.</p>}</div><div className="flex items-center gap-2"><button aria-label="Diminuir quantidade" type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-violet-50" onClick={()=>qty(it.product.id,-1)}><Minus className="h-3 w-3"/></button><strong className="min-w-5 text-center text-xs">{it.quantity}</strong><button aria-label="Aumentar quantidade" type="button" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-violet-50" onClick={()=>qty(it.product.id,1)}><Plus className="h-3 w-3"/></button></div><span className="min-w-[100px] text-right text-sm font-black text-slate-900">{money(it.quantity*it.product.price)}</span><button type="button" aria-label="Excluir item" className="text-rose-500" onClick={()=>setItems(x=>x.filter(y=>y.product.id!==it.product.id))}><Trash2 className="h-4 w-4"/></button></div>)}</div>}
     <div className="flex justify-between border-t border-slate-200 bg-slate-50 p-4 text-sm font-black"><span>Subtotal</span><span>{money(subtotalCents/100)}</span></div>
    </section>
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
     <h2 className="flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-black text-slate-900"><UserRound className="h-4 w-4 text-violet-600"/> Identificação do atendimento</h2>
     <div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-1"><span className="text-[11px] font-bold text-slate-600">Cliente cadastrado</span><select className={field} value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">Consumidor final não identificado</option>{aux.customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>


     <label className="block space-y-1"><span className="text-[11px] font-bold text-slate-600">Vendedor responsável *</span><select className={field} value={sellerId} onChange={e=>setSellerId(e.target.value)}><option value="">Selecione...</option>{aux.sellers.map(s=><option key={s.id} value={s.id}>{s.name} {s.jobTitle?"("+s.jobTitle+")":""}</option>)}</select></label>
     </div>
     <label className="block space-y-1"><span className="text-[11px] font-bold text-slate-600">CPF/CNPJ para documento fiscal futuro</span><input className={field} value={cpf} onChange={e=>setCpf(formatCpfCnpj(e.target.value))} inputMode="numeric" placeholder="Opcional — não utilizado no orçamento" maxLength={18}/></label>
     {customer&&<p className="text-[10px] text-slate-500">Cliente selecionado: {customer.name}. Pontuação de fidelidade não integrada; nenhum ponto será creditado automaticamente.</p>}
<p className="text-[10px] text-slate-500">Vínculo do vendedor persistido no orçamento; comissão financeira não será gerada sem módulo oficial.</p>
    </section>
<details className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-slate-700"><Wrench className="h-4 w-4 text-violet-600"/> Consultar ordem de serviço <span className="ml-auto text-[10px] text-slate-500">{aux.repairs.length} disponíveis</span><ChevronRight className="h-4 w-4 text-slate-400 group-open:rotate-90"/></summary>
     {aux.repairs.length===0?<p className="mt-2 text-xs text-slate-600">Não há OS marcada como pronta para retirada nesta filial.</p>:<select value={repairId} onChange={e=>setRepairId(e.target.value)} className={field+" mt-2"}><option value="">Consulte uma OS concluída...</option>{aux.repairs.map(r=><option key={r.id} value={r.id}>{r.orderNumber} — {r.defect} ({money(r.finalPrice)})</option>)}</select>}
     <p className="mt-2 text-[11px] text-slate-600">OS vinculada apenas para consulta nesta etapa. O faturamento exige conciliação de serviços, peças e status da OS; não será criado SKU fictício.</p>
    </details>
   </div>
   <div className="min-w-0 space-y-4">
    
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
     <h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><Wallet className="h-4 w-4 text-violet-600"/> Resumo e pagamento</h2><div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Total previsto</p><p className="mt-1 text-3xl font-black tracking-tight text-violet-800 tabular-nums">{money(total)}</p><div className="mt-3 space-y-1.5 border-t border-violet-100 pt-3 text-xs text-slate-600"><div className="flex justify-between"><span>Subtotal</span><span>{money(subtotalCents/100)}</span></div><div className="flex justify-between"><span>Desconto</span><span>− {money(discountCents/100)}</span></div></div></div>
     <div><div className="mb-1 flex items-center justify-between text-[11px] font-bold text-slate-600"><span>Desconto global</span><div className="flex gap-1">{(["value","percent"] as const).map(m=><button key={m} type="button" onClick={()=>setDiscountMode(m)} className={"rounded-lg px-2 py-1 text-[10px] "+(discountMode===m?"bg-violet-600 text-white":"bg-slate-100 text-slate-600")}>{m==="value"?"R$":"%"}</button>)}</div></div><input className={field} type="number" min="0" max={discountMode==="percent"?100:undefined} step="0.01" value={discountInput} onChange={e=>setDiscountInput(e.target.value)} placeholder={discountMode==="value"?"Desconto em R$":"Desconto em %"}/>
      {discountCents>0&&!aux.capabilities.discountOverride&&<p className="mt-1 text-[10px] text-rose-600">Sua permissão não permite conceder descontos.</p>}</div>
     <div><span className="mb-2 block text-[11px] font-bold text-slate-600">Forma prevista de pagamento</span><div className="grid grid-cols-2 gap-2">{([{id:"Pix",label:"Pix",icon:QrCode},{id:"CreditCard",label:"Crédito",icon:CreditCard},{id:"DebitCard",label:"Débito",icon:Wallet},{id:"Cash",label:"Dinheiro",icon:Banknote}] as const).map(p=><button key={p.id} type="button" onClick={()=>{setMethod(p.id);setInstallments(1);}} aria-pressed={method===p.id} className={"flex min-h-12 items-center justify-center gap-2 rounded-xl border p-3 text-xs font-bold "+(method===p.id?"border-violet-500 bg-violet-50 text-violet-700":"border-slate-200 bg-slate-50 text-slate-600")}><p.icon className="h-4 w-4"/>{p.label}</button>)}</div></div>
     {method==="CreditCard"&&<div><label className="mb-2 block text-[11px] font-bold text-slate-600">Parcelamento de 1x a 18x — sem juros para o cliente</label>
      <div className="grid max-h-44 grid-cols-3 gap-1.5 overflow-y-auto">{Array.from({length:18},(_,i)=>i+1).map(n=>{const values=distributeInstallments(totalCents,n);return <button key={n} type="button" onClick={()=>setInstallments(n)} aria-pressed={installments===n} className={"rounded-xl border px-2 py-2 text-left transition-colors "+(installments===n?"border-violet-500 bg-violet-50":"border-slate-200 bg-slate-50 hover:bg-white")}><strong className="block text-xs text-slate-900">{n}x</strong><span className="text-[11px] font-bold text-violet-700">{money((values[0]||0)/100)}</span></button>;})}</div>
      {selectedParts.length>0&&<div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs"><div className="flex justify-between font-bold"><span>Plano selecionado</span><span>{installments}x</span></div><p className="mt-1 text-slate-500">{selectedParts.every(x=>x===selectedParts[0])?installments+" parcelas de "+money(selectedParts[0]/100):selectedParts.map((v,i)=>(i+1)+"ª "+money(v/100)).join(" • ")}</p><p className="mt-1 text-[10px] text-slate-500">O cliente não paga juros nesta simulação. As taxas da maquininha são despesas da loja, mostradas abaixo. Nenhuma transação foi autorizada.</p></div>}
     </div>}
     {method==="Cash"&&<div><label className="mb-1 block text-[11px] font-bold text-slate-600">Valor recebido (simulação)</label><input type="number" min="0" step="0.01" className={field} value={cashReceived} onChange={e=>setCashReceived(e.target.value)}/><p className="mt-1 text-xs font-bold text-emerald-700">Troco previsto: {money(change)}</p></div>}
     {canSeeMerchantFees&&paymentMethod&&totalCents>0&&<div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-xs">
       <div className="flex flex-wrap justify-between gap-2 font-black text-slate-900">
        <span>Previsão de repasse da maquininha — despesas da loja</span>
        <a href="/financial/acquirers" className="font-semibold text-violet-700 underline">Configurar taxas</a>
       </div>
       {(merchantFees?.profiles.length||0)>1&&<label className="block text-xs">Maquininha
        <select value={acquirerId} onChange={e=>setAcquirerId(e.target.value)} className={field+" mt-1"}>
         <option value="">Selecione a maquininha</option>
         {merchantFees?.profiles.map(p=><option key={p.id} value={p.id}>{p.name} — {p.provider}</option>)}
        </select>
       </label>}
       {merchantFeeLoading?<p className="text-slate-500">Calculando taxas contratadas no Neon...</p>:
        merchantFeeError?<p role="alert" className="font-semibold text-amber-800">{merchantFeeError}</p>:
        merchantFees?.configured&&merchantFees.quote?<div className="space-y-1.5">
         <div className="flex justify-between"><span>Venda bruta — cliente</span><strong>{money(merchantFees.quote.grossCents/100)}</strong></div>
         <div className="flex justify-between text-rose-700"><span>MDR da operadora</span><strong>− {money(merchantFees.quote.mdrFeeCents/100)}</strong></div>
         <div className="flex justify-between text-rose-700"><span>Antecipação e tarifa fixa</span><strong>− {money((merchantFees.quote.anticipationFeeCents+merchantFees.quote.fixedFeeCents)/100)}</strong></div>
         <div className="flex justify-between border-t border-slate-200 pt-2 text-emerald-700"><span>Líquido previsto para a empresa</span><strong>{money(merchantFees.quote.netExpectedCents/100)}</strong></div>
         <p className="text-[10px] text-slate-500">Tabela v{merchantFees.profileVersion} • Repasse {merchantFees.quote.settlementMode==="MONTHLY"?"mensal (estimado)":"único"} • D+{merchantFees.quote.settlementDays}. Somente a conciliação confirma o líquido real.</p>
         {merchantFees.quote.settlementMode==="MONTHLY"&&merchantFees.quote.merchantExpectedInstallmentsCents.length>1&&
          <p className="text-[10px] text-slate-500">Previsão de recebíveis: {merchantFees.quote.merchantExpectedInstallmentsCents.map((v,i)=>(i+1)+"ª "+money(v/100)).join(" • ")}</p>}
        </div>:<p className="text-amber-800">{merchantFees?.explanation||"Nenhuma taxa de adquirente disponível. O sistema não presume taxa zero nem líquido igual ao bruto."}</p>}
       <p className="text-[10px] text-slate-400">Simulação informativa: não cria pagamento, contas a receber nem liquidação.</p>
      </div>}
     
     {!isDiscountValid&&<p className="text-xs text-rose-600">Desconto inválido. Ajuste antes de salvar.</p>}
     <button className={primary+" w-full"} disabled={!canQuote||saving} onClick={()=>void saveQuote()}><FileText className="h-4 w-4"/>{saving?"Salvando no Neon...":"Salvar orçamento real"}</button>
     {!aux.capabilities.saveQuote&&<p className="text-xs text-amber-700">Permissão sales.create é necessária para salvar.</p>}
     {!qaCheckout&&trainingMode&&<button type="button" className="w-full rounded-xl bg-rose-700 p-3 text-xs font-black text-white disabled:opacity-50"
        disabled={saving||!items.length||!sellerId||totalCents<=0||!isDiscountValid||
         (discountCents>0&&!aux.capabilities.discountOverride)}
        onClick={()=>void saveTraining()}>
        <Receipt className="mr-2 inline h-4 w-4"/>{saving?"Salvando...":"Registrar venda SIMULADA — sem financeiro / fiscal"}
       </button>}
       {!qaCheckout&&!trainingMode&&<button className={button+" w-full"} disabled title="Checkout aguarda conciliação real de estoque e pagamentos"><LockKeyhole className="h-4 w-4"/> Concluir venda — em homologação</button>}
    {qaCheckout&&<button type="button" className={button+" w-full"} onClick={()=>setTab("internal")}><Banknote className="h-4 w-4"/> Venda interna (homologação)<ChevronRight className="ml-auto h-4 w-4"/></button>}
<p className="text-[11px] leading-relaxed text-slate-500">Orçamento não confirma pagamento, não reserva estoque e não emite documento fiscal.</p></section>
<section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><ShieldAlert className="h-4 w-4 text-amber-600"/> Situação operacional</h2><p className="text-xs font-semibold text-amber-800">Emissão fiscal ainda não homologada.</p><p className="text-xs text-slate-600">{aux.cashShift?"Turno encontrado: "+aux.cashShift.register:"Nenhum turno aberto para este operador."} A finalização comercial real permanece protegida.</p><a href="/cash" className={button+" w-full"}><Clock className="h-4 w-4"/> Consultar caixa e turnos</a><details className="group rounded-xl border border-slate-200 bg-slate-50 p-3" open={trainingMode&&!qaCheckout||documentMode==="INTERNAL"||!!documentModeError?true:undefined}><summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-bold text-slate-700"><Info className="h-4 w-4"/> Fiscal, treinamento e pré-requisitos<ChevronRight className="ml-auto h-4 w-4 group-open:rotate-90"/></summary><div className="mt-3 space-y-3">{!qaCheckout&&<>     <div className={"rounded-xl border p-3 text-xs "+(trainingMode?"border-rose-700 bg-rose-50 text-rose-900":"border-slate-200 bg-slate-50 text-slate-800")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
       <strong>{trainingMode?"TREINAMENTO ATIVO — NÃO É VENDA REAL":"TREINAMENTO DESATIVADO"}</strong>
       <button type="button" onClick={()=>setTrainingMode(v=>!v)}
        className="rounded-lg bg-rose-700 px-3 py-2 font-bold text-white">Ctrl + F1 • {trainingMode?"Desativar":"Ativar simulação"}</button>
      </div>
      <p className="mt-2">{trainingMode?
       "Simulação para qualquer cliente e operador com acesso ao PDV. Não movimenta estoque, caixa, receita, contabilidade ou SEFAZ.":
       "Para operações reais, continuam necessárias liquidação homologada e regras fiscais aplicáveis."}</p>
     </div>
</>}
     <div className={"rounded-xl border p-3 text-xs "+(documentMode==="INTERNAL"?"border-red-600 bg-red-50 text-red-900":"border-slate-200 bg-slate-50 text-slate-800")}>
    <div className="flex flex-wrap items-center justify-between gap-2">
     <div className="flex items-center gap-2 font-black"><Receipt className="h-4 w-4"/>{documentMode==="INTERNAL"?"COMPROVANTE INTERNO — NÃO FISCAL":"MODO FISCAL"}</div>
     <button type="button" disabled={checkingDocumentMode} onClick={()=>void toggleDocumentMode()}
      className={"rounded-lg px-3 py-1.5 font-extrabold disabled:opacity-50 "+(documentMode==="INTERNAL"?"bg-red-700 text-white":"bg-slate-800 text-white")}>
      {checkingDocumentMode?"Verificando...":"Consultar dispensa legal"}
     </button>
    </div>
    <p className="mt-2">{documentMode==="INTERNAL"?
      "Pré-avaliação autorizada por política fiscal vigente da filial. Esta seleção não finaliza a venda nem dispensa a validação fiscal obrigatória no servidor.":
      "Modo padrão: operação destinada ao fluxo de documento fiscal quando a emissão estiver homologada."}</p>
    <label className="mt-2 flex items-center gap-2 font-semibold">
     <input type="checkbox" checked={fiscalRequested} onChange={e=>setFiscalRequested(e.target.checked)}/>
     Cliente solicitou documento fiscal
    </label>
    {documentModeError&&<div role="alert" className="mt-2 rounded-lg bg-amber-100 p-2 font-semibold text-amber-900">{documentModeError}</div>}
    <p className="mt-2 text-[10px]">Ctrl + F1 alterna apenas treinamento; o modo fiscal real depende de elegibilidade própria.</p>
   </div>
   <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800"><div className="flex items-center gap-2 font-black"><ShieldAlert className="h-4 w-4"/> Finalização protegida</div><p className="mt-1">Venda, baixa de estoque, cobrança e emissão de NFC-e exigem confirmação transacional e fiscal real. Não serão simuladas. {aux.cashShift?"Turno encontrado: "+aux.cashShift.register:"Nenhum turno de caixa aberto para este operador."}</p><a href="/cash" className="mt-2 inline-flex rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100">Consultar ou abrir turno no Caixa</a></div>
     {readiness&&<div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
       <strong className="block text-slate-800">Pré-requisitos verificados nesta filial</strong>
       <ul className="mt-2 space-y-1.5">
        {readiness.checks.map(check=><li key={check.code} className="flex items-center justify-between gap-2">
         <span className={check.ready?"text-emerald-700":"text-amber-800"}>{check.ready?"✓":"•"} {check.label}</span>
         {!check.ready&&<a href={check.module} className="font-semibold underline">Ver módulo</a>}
        </li>)}
       </ul>
       <p className="mt-3 text-amber-800">{readiness.checkoutBlocker}</p>
       <p className="mt-1 text-slate-600">{readiness.fiscalBlocker}</p>
      </div>}
      </div></details></section>
   </div>
  </div>
  :tab==="quotes"?<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="text-sm font-black text-slate-900">Orçamentos registrados no Neon</h2><p className="text-xs text-slate-500">Propostas comerciais não são venda nem comprovante de pagamento.</p></div><button className={primary} onClick={()=>setTab("pos")}><Plus className="h-4 w-4"/> Novo orçamento</button></div>
   {quotes.length===0?<div className="p-12 text-center text-xs text-slate-500">Nenhum orçamento encontrado para esta filial.</div>:<div className="divide-y divide-slate-100">{quotes.map(q=><div key={q.id} className="flex flex-wrap items-center justify-between gap-4 p-4"><div><strong className="font-mono text-xs text-violet-700">{q.number}</strong><p className="mt-1 text-xs text-slate-600">{q.customer||"Consumidor não identificado"} • Vendedor: {q.seller||"—"}</p><p className="text-[10px] text-slate-400">Criado em {dateText(q.createdAt)} • Válido até {dateText(q.validUntil)}</p></div><div className="flex items-center gap-3"><strong className="text-base text-slate-900">{money(q.total)}</strong><button className={button} onClick={()=>setSelectedQuote(q)}><ClipboardList className="h-4 w-4"/> Detalhes</button></div></div>)}</div>}
  </section>
  :tab==="training"?<section className="rounded-2xl border-2 border-rose-200 bg-white shadow-sm">
      <div className="border-b border-rose-200 bg-rose-50 p-5">
       <h2 className="font-black text-rose-900">Vendas simuladas — treinamento</h2>
       <p className="mt-1 text-xs text-rose-800">Valores aqui não compõem vendas reais, faturamento, caixa, estoques ou relatórios financeiros oficiais.</p>
      </div>
      {trainingLastUrl&&<a href={trainingLastUrl} target="_blank" rel="noopener noreferrer"
        className="m-4 inline-block rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white">Imprimir última simulação</a>}
      {trainingSales.length===0?<p className="p-8 text-sm text-slate-500">Nenhuma simulação registrada nesta filial.</p>:
       <div className="overflow-x-auto"><table className="w-full text-left text-xs">
        <thead className="bg-slate-50"><tr>{["Número","Data","Cliente","Vendedor","Total simulado","Status","Ações"].map(x=><th key={x} className="px-3 py-3">{x}</th>)}</tr></thead>
        <tbody>{trainingSales.map(t=><tr key={t.id} className="border-t border-slate-100">
         <td className="px-3 py-3 font-mono text-[10px]">{t.number}</td><td className="px-3 py-3">{dateText(t.createdAt)}</td>
         <td className="px-3 py-3">{t.customer||"Não identificado"}</td><td className="px-3 py-3">{t.seller}</td>
         <td className="px-3 py-3 font-bold">{money(Number(t.totalCents)/100)}</td>
         <td className="px-3 py-3">{t.status==="VOIDED"?"Cancelada":"Simulação"}</td>
         <td className="px-3 py-3"><div className="flex gap-2">
          <a href={buildPrintUrl("training-sale",t.id,"80")} target="_blank" rel="noopener noreferrer" className={button}>Imprimir</a>
          {t.status==="SIMULATED"&&hasPermission("sales.cancel")&&<button type="button" className={button} onClick={()=>void voidTraining(t.id)}>Cancelar</button>}
         </div></td>
        </tr>)}</tbody></table></div>}
     </section>
  :<section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><h2 className="text-sm font-black text-slate-900">Histórico de vendas persistidas</h2><p className="text-xs text-slate-500">Nenhuma autorização fiscal é presumida. Status refletido diretamente no Neon.</p></div>
   {history.length===0?<div className="p-12 text-center text-xs text-slate-500">Nenhuma venda cadastrada nesta filial.</div>:<div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr>{["Venda","Data","Cliente","Vendedor","Total","Status","Detalhes"].map(x=><th key={x} className="px-4 py-3">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{history.map(s=><tr key={s.id}><td className="px-4 py-3 font-mono font-bold text-violet-700">{s.saleNumber}</td><td className="px-4 py-3">{dateText(s.createdAtUtc)}</td><td className="px-4 py-3">{s.customerName}</td><td className="px-4 py-3">{s.sellerName}</td><td className="px-4 py-3 font-bold">{money(s.totalAmount)}</td><td className="px-4 py-3"><span className="rounded-lg bg-slate-100 px-2 py-1">{statusSale[s.status]||"Desconhecido"}</span></td><td className="px-4 py-3"><button className={button} onClick={()=>setSelectedSale(s)}>Visualizar</button></td></tr>)}</tbody></table></div>}
  </section>}
  {!authLoading&&permitted&&<div className={tab==="internal"&&!loading?"":"hidden"}><InternalCheckoutPanel onAvailability={internalAvailability} onChange={()=>{void api<{sales:Sale[]}>("/api/sales").then(x=>setHistory(x.sales)).catch(()=>{});}}/></div>}
  </div>
  {confirmClear&&<Modal title="Limpar carrinho?" onClose={()=>setConfirmClear(false)}><p className="text-sm text-slate-600">Os itens deste atendimento serão removidos. Nenhum estoque ou pagamento será movimentado.</p><div className="mt-5 flex justify-end gap-2"><button type="button" className={button} onClick={()=>setConfirmClear(false)}>Voltar</button><button type="button" className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white" onClick={()=>{setItems([]);setConfirmClear(false);searchRef.current?.focus();}}>Limpar itens</button></div></Modal>}
 {selectedQuote&&<Modal title={"Orçamento "+selectedQuote.number} onClose={()=>setSelectedQuote(null)}>
   <div id="quote-print" className="space-y-4"><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-black text-amber-800">ORÇAMENTO — NÃO É CUPOM FISCAL, NÃO COMPROVA PAGAMENTO E NÃO RESERVA ESTOQUE.</div>
    <p className="text-xs text-slate-500">Cliente: {selectedQuote.customer||"Consumidor não identificado"} • Vendedor: {selectedQuote.seller||"—"} • Validade: {dateText(selectedQuote.validUntil)}</p>
    <div className="divide-y divide-slate-100">{selectedQuote.items.map((i,idx)=><div key={idx} className="flex justify-between py-3 text-xs"><span>{i.quantity}x {i.description} <small className="text-slate-400">{i.sku}</small></span><strong>{money(i.quantity*i.price)}</strong></div>)}</div>
    <div className="rounded-xl bg-slate-50 p-4"><div className="flex justify-between text-xs"><span>Desconto</span><span>{money(selectedQuote.discount)}</span></div><div className="mt-2 flex justify-between text-lg font-black"><span>Total do orçamento</span><span>{money(selectedQuote.total)}</span></div><p className="mt-2 text-xs text-slate-500">Condição pretendida: {selectedQuote.paymentTerms}</p></div>
   <div className="no-print flex flex-wrap gap-2">
    <a className={button} href={"/documents/print?kind=quote&id="+encodeURIComponent(selectedQuote.id)+"&paper=80"} target="_blank" rel="noopener noreferrer"><Printer className="h-4 w-4"/> Bobina 80/58 mm</a>
    <a className={button} href={"/documents/print?kind=quote&id="+encodeURIComponent(selectedQuote.id)+"&paper=A4"} target="_blank" rel="noopener noreferrer"><FileText className="h-4 w-4"/> A4 / PDF / WhatsApp</a>
    <a className={button} href={"/documents/print?kind=training&id="+encodeURIComponent(selectedQuote.id)+"&paper=80"} target="_blank" rel="noopener noreferrer"><Printer className="h-4 w-4"/> Teste de cupom (SIMULAÇÃO)</a>
   </div>
   </div>
  </Modal>}
  {selectedSale&&<Modal title={"Venda "+selectedSale.saleNumber} onClose={()=>setSelectedSale(null)}>
   <div className="space-y-3 text-xs"><p className="text-slate-600">Status: <strong>{statusSale[selectedSale.status]||"Desconhecido"}</strong> • Pagamento: status {selectedSale.paymentStatus}</p>
    <p className="text-slate-600">Cliente: {selectedSale.customerName} • Vendedor: {selectedSale.sellerName}</p>
    {selectedSale.items.map((i,idx)=><div key={idx} className="flex justify-between border-b border-slate-100 py-2"><span>{i.quantity}x {i.description}</span><strong>{money(i.quantity*i.unitPrice)}</strong></div>)}
    <div className="flex justify-between font-black"><span>Total registrado</span><span>{money(selectedSale.totalAmount)}</span></div>
    <h3 className="mt-4 font-bold">Pagamentos registrados</h3>{selectedSale.payments.length===0?<p className="text-slate-400">Nenhum pagamento registrado.</p>:selectedSale.payments.map((p,i)=><p key={i} className="text-slate-600">Método {p.method} • {p.installments}x • {money(p.amount)} • Status {p.status}</p>)}
    <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">Somente documentos com autorização oficial validada podem gerar DANFE NFC-e. Cancelamentos e estornos aguardam o motor fiscal e financeiro homologado.</p>
   </div>
  </Modal>}
 </RootShellLayout>;
}
