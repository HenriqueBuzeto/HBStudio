"use client";

import {useEffect,useRef,useState} from "react";
import {getBrowserPrintSettings,saveBrowserPrintSettings} from "@/lib/browser-print";
import RootShellLayout from "@/components/RootShellLayout";
import {formatCnpj} from "@/lib/br-format";
import {Printer,FileDown,MessageCircle,RefreshCw,AlertTriangle,FileText,ShieldAlert} from "lucide-react";

type Paper="58"|"80"|"A4";
type Document={
 kind:"quote"|"training"|"training-sale"|"service"|"contract";documentType:string;number:string;issuedAt:string;
 organization:{name:string;legalName:string;branch:string;cnpj:string|null;address:string};
 customer:string;items:Array<{sku?:string;description:string;quantity:number;unitPrice:number;discount:number;category?:string}>;
 totals:{subtotal:number;discount:number;shipping:number;total:number};
 validUntil?:string;paymentTerms?:string|null;notes?:string|null;disclaimer:string;
 detail?:{equipment:string;defect:string;condition:string|null;diagnostic:string|null;
 resolution:string|null;legalWarrantyDays:number;additionalWarrantyDays:number};
};
const money=(value:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);
const date=(value:string)=>new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(value));
const quantity=(v:number)=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:3}).format(v);
const paperOptions:{code:Paper;name:string}[]=[
 {code:"80",name:"Bobina 80 mm"},{code:"58",name:"Bobina 58 mm"},{code:"A4",name:"Folha A4"}
];
export default function DocumentPrintPage(){
 const [document,setDocument]=useState<Document|null>(null);
 const [kind,setKind]=useState(""),[id,setId]=useState("");
 const [paper,setPaper]=useState<Paper>("80");
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [reference,setReference]=useState("");
 const attemptedAutoPrint=useRef(false);
 const [autoMessage,setAutoMessage]=useState("");
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const docKind=params.get("kind")||"";
  const docId=params.get("id")||"";
  const requestedPaper=params.get("paper");
  setKind(docKind);setId(docId);
  const defaultPaper=getBrowserPrintSettings().paper;
  const selected= requestedPaper==="58"||requestedPaper==="80"||requestedPaper==="A4"?requestedPaper:defaultPaper;
  setPaper(docKind==="contract"?"A4":selected);
  if(!["quote","training","training-sale","service","contract"].includes(docKind)||!/^[a-f\d-]{36}$/i.test(docId)){
   setError("Documento ou identificador inválido.");setLoading(false);return;
  }
  const controller=new AbortController();
  fetch(`/api/documents/${docKind}/${docId}`,{cache:"no-store",signal:controller.signal})
   .then(async response=>{
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||"Documento não disponível.");
    setDocument(data as Document);
   }).catch(err=>{if(!controller.signal.aborted)setError(err instanceof Error?err.message:"Erro ao consultar documento.");})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[]);
 // An automatic print attempt only follows a successfully retrieved, authorized document.
 // Guard per tab against React StrictMode double effects, refresh and browser back.
 useEffect(()=>{
  if(!document||attemptedAutoPrint.current)return;
  const params=new URLSearchParams(window.location.search);
  if(params.get("auto")!=="1")return;
  const prefs=getBrowserPrintSettings();
  const authorizedPreference=
    (kind==="quote"&&prefs.autoPrintQuote)||(kind==="service"&&prefs.autoPrintService)||(kind==="training-sale"&&prefs.autoPrintSale);
  if(!authorizedPreference)return;
  attemptedAutoPrint.current=true;
  const onceKey=`hbstudio:autoprint:v1:${kind}:${id}`;
  try{
   if(sessionStorage.getItem(onceKey)==="attempted")return;
   sessionStorage.setItem(onceKey,"attempted");
  }catch{
   setAutoMessage("Autoimpressão não iniciada: armazenamento de sessão indisponível. Use Imprimir.");
   return;
  }
  // window.print requests a print dialog or kiosk job; it does not prove paper was printed.
  const launch=async()=>{
   try{
    await window.document.fonts?.ready;
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
    if(!window.location.pathname.endsWith("/documents/print"))return;
    setAutoMessage("Impressão solicitada ao navegador. Confirme o papel na impressora.");
    window.print();
   }catch{
    setAutoMessage("A impressão automática foi bloqueada. Clique em Imprimir.");
   }
  };
  void launch();
 },[document,kind,id]);

 const isContract=kind==="contract";
 const effectivePaper=isContract?"A4":paper;
 const title=kind==="training-sale"?"VENDA SIMULADA — TREINAMENTO":kind==="training"?"SIMULAÇÃO — TESTE DE IMPRESSÃO":kind==="quote"?"ORÇAMENTO COMERCIAL":kind==="contract"?"MINUTA DE TERMO DE SERVIÇO":"ORDEM DE SERVIÇO";
 const shareText=document?
  [title+` ${document.number}`,`Cliente: ${document.customer}`,
    `Total informado: ${money(document.totals.total)}`,
    kind==="quote"&&document.validUntil?`Validade: ${date(document.validUntil)}`:"",
    "Documento interno. Não é nota ou cupom fiscal. O PDF pode ser anexado manualmente, após salvar pelo navegador."
   ].filter(Boolean).join("\n"):"";
 const shareWhatsapp=()=>{
  if(!document)return;
  const popup=window.open("https://wa.me/?text="+encodeURIComponent(shareText),"_blank","noopener,noreferrer");
  if(!popup)setError("Permita a abertura do WhatsApp ou copie o resumo do documento.");
 };
 const startPrint=()=>window.print();
 const copySummary=async()=>{
  if(!document)return;
  try{await navigator.clipboard.writeText(shareText);setReference("Resumo copiado para compartilhar.");}
  catch{setError("Não foi possível copiar. Verifique as permissões do navegador.");}
 };
 return <RootShellLayout>
  <style>{`
   @media print {
    @page {size: ${effectivePaper==="A4"?"A4":"auto"};margin:${effectivePaper==="A4"?"12mm":"0"};}
    html,body {margin:0!important;padding:0!important;background:#fff!important;color:#000!important;}
    body * {visibility:hidden!important;}
    #hb-printed-document,#hb-printed-document * {visibility:visible!important;}
    #hb-printed-document {position:absolute!important;left:0!important;top:0!important;
      border:0!important;box-shadow:none!important;margin:0!important;
      padding:${effectivePaper==="A4"?"0":"2mm 1.5mm 4mm"}!important;
      box-sizing:border-box!important;width:${effectivePaper==="A4"?"100%":effectivePaper==="80"?"68mm":"46mm"}!important;
      max-width:none!important;min-height:auto!important;background:#fff!important;
      color:#000!important;overflow:visible!important;overflow-wrap:break-word!important;word-break:normal!important;print-color-adjust:exact;}
    .hb-receipt-row{display:flex!important;align-items:baseline!important;justify-content:space-between!important;gap:2mm!important;max-width:100%!important;}
    .hb-receipt-row>:first-child{min-width:0!important;}
    .hb-receipt-row>:last-child{white-space:nowrap!important;flex-shrink:0!important;text-align:right!important;}
    .hb-receipt-item{break-inside:avoid!important;page-break-inside:avoid!important;}
    .hb-print-actions {display:none!important;}
    #hb-printed-document table {width:100%;border-collapse:collapse;}
    #hb-printed-document tr {break-inside:avoid;}
    #hb-printed-document {font-size:${effectivePaper==="58"?"9px":effectivePaper==="80"?"11px":"12px"}!important;}
   }
  `}</style>
  <div className="mx-auto max-w-5xl space-y-4 pb-12">
   <header className="hb-print-actions flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
    <div><h1 className="text-lg font-black text-slate-900">Central de impressão e documentos</h1>
     <p className="mt-1 text-xs text-slate-600">Impressão pelo driver do Windows/macOS, exportação em PDF do navegador e compartilhamento via WhatsApp.</p>
    </div>
    <div className="flex flex-wrap gap-2">
     <a className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold" href="/documents/printers">Configurar impressora</a>
     <a className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold" href="/sales">Voltar ao PDV</a>
    </div>
   </header>
   {loading&&<div className="rounded-xl border bg-white p-6 text-sm">Consultando documento no Neon...</div>}
   {error&&<div role="alert" className="hb-print-actions flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertTriangle className="h-5 w-5 shrink-0"/>{error}</div>}
   {document&&<>
    {(kind==="training"||kind==="training-sale")&&<div role="alert" className="hb-print-actions rounded-xl border border-red-300 bg-red-50 p-4 text-xs font-black text-red-800">MODO TREINAMENTO: gera apenas uma prévia imprimível do orçamento. Não registra venda, pagamento, movimentação de estoque ou valor em caixa.</div>}
    <div className="hb-print-actions space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
     <div className="flex flex-wrap gap-2">
      {paperOptions.filter(p=>!isContract||p.code==="A4").map(option=>
       <button type="button" key={option.code} onClick={()=>{setPaper(option.code);const p=getBrowserPrintSettings();saveBrowserPrintSettings({...p,paper:option.code});}}
        className={"rounded-lg border px-3 py-2 text-xs font-bold "+(effectivePaper===option.code?"border-violet-700 bg-violet-50 text-violet-800":"border-slate-200 text-slate-600")}>
        {option.name}
       </button>)}
     </div>
     <div className="flex flex-wrap gap-2">
      <button onClick={startPrint} className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-xs font-bold text-white"><Printer className="h-4 w-4"/>Imprimir</button>
      <button onClick={startPrint} className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold"><FileDown className="h-4 w-4"/>Salvar como PDF</button>
      <button onClick={shareWhatsapp} className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold"><MessageCircle className="h-4 w-4"/>Compartilhar no WhatsApp</button>
      <button onClick={()=>void copySummary()} className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold"><FileText className="h-4 w-4"/>Copiar resumo</button>
     </div>
     <p className="text-xs text-slate-600">Para PDF, escolha <strong>Salvar como PDF</strong> como destino na janela de impressão. O WhatsApp receberá o resumo; anexe o PDF manualmente após salvar. A impressão direta e silenciosa exige um conector local instalado e autorizado.</p>
     {reference&&<p role="status" className="text-xs font-semibold text-emerald-700">{reference}</p>}
     {autoMessage&&<p role="status" className="text-xs font-semibold text-amber-800">{autoMessage}</p>}
    </div>
    <article id="hb-printed-document" className={"mx-auto border border-slate-200 bg-white p-5 text-slate-900 shadow-sm "+(effectivePaper==="A4"?"max-w-[210mm]":"")} style={{boxSizing:"border-box",width:effectivePaper==="A4"?"100%":effectivePaper==="80"?"68mm":"46mm",fontSize:effectivePaper==="58"?10:effectivePaper==="80"?12:14,overflowWrap:"break-word",wordBreak:"normal"}}>
     <div className="border-b-2 border-slate-900 pb-3 text-center">
      <h2 className="font-black uppercase">{document.organization.name}</h2>
      {document.organization.cnpj&&<p>CNPJ: {formatCnpj(document.organization.cnpj)}</p>}
      <p>{document.organization.branch}</p>
      {document.organization.address&&<p>{document.organization.address}</p>}
     </div>
     <div className="mt-4 border-b border-dashed border-slate-600 pb-3 text-center">
      <h3 className="font-black">{title}</h3>
      <p>Nº {document.number}</p>
      <p>{date(document.issuedAt)}</p>
     </div>
     <div className="my-3 space-y-1"><p><strong>Cliente:</strong> {document.customer}</p>
      {document.validUntil&&<p><strong>Válido até:</strong> {date(document.validUntil)}</p>}
      {document.paymentTerms&&<p><strong>Condição prevista:</strong> {document.paymentTerms}</p>}
     </div>
     {document.detail&&<div className="my-3 border-t border-dashed border-slate-500 pt-2">
      <p><strong>Aparelho:</strong> {document.detail.equipment}</p>
      <p><strong>Defeito relatado:</strong> {document.detail.defect}</p>
      {document.detail.condition&&<p><strong>Condição física:</strong> {document.detail.condition}</p>}
      {document.detail.diagnostic&&<p><strong>Diagnóstico:</strong> {document.detail.diagnostic}</p>}
      {document.detail.resolution&&<p><strong>Serviço realizado:</strong> {document.detail.resolution}</p>}
     </div>}
     <section aria-label="Itens" className="border-t border-slate-800 pt-2">
      <div className="hb-receipt-row border-b border-slate-600 pb-1 font-bold"><span>ITENS / DESCRIÇÃO</span><span>VALOR</span></div>
      {document.items.map((item,i)=><div key={i} className="hb-receipt-item border-b border-dotted border-slate-400 py-2">
       <p className="font-semibold">{String(i+1).padStart(2,"0")} · {item.description}</p>
       {item.sku&&<p className="text-[0.85em]">Cód.: {item.sku}</p>}
       <div className="hb-receipt-row mt-1"><span>{quantity(item.quantity)} × {money(item.unitPrice)}</span><strong>{money(item.quantity*item.unitPrice-item.discount)}</strong></div>
       {item.discount>0&&<div className="hb-receipt-row"><span>Desconto do item</span><span>− {money(item.discount)}</span></div>}
      </div>)}
     </section>
     <div className="mt-3 space-y-1 border-t border-dashed border-slate-600 pt-2">
      <div className="hb-receipt-row"><span>Itens</span><span>{quantity(document.items.reduce((n,i)=>n+i.quantity,0))}</span></div>
      <div className="hb-receipt-row"><span>Subtotal</span><span>{money(document.totals.subtotal)}</span></div>
      {document.totals.discount>0&&<div className="hb-receipt-row"><span>Desconto</span><span>− {money(document.totals.discount)}</span></div>}
      {document.totals.shipping>0&&<div className="hb-receipt-row"><span>Frete</span><span>{money(document.totals.shipping)}</span></div>}
      <div className="hb-receipt-row mt-2 border-t-2 border-slate-900 pt-2 text-[1.12em] font-black"><span>TOTAL</span><span>{money(document.totals.total)}</span></div>
     </div>
     {document.notes&&<p className="mt-4"><strong>Observações:</strong> {document.notes}</p>}
     {isContract&&<div className="mt-8 space-y-5 text-sm">
      <p>Este termo acompanha a ordem de serviço identificada e descreve os itens orçados e a condição informada no atendimento. Não substitui termos comerciais específicos nem constitui aceite automático.</p>
      <p>Garantias legais e adicionais serão verificadas de acordo com a operação e a legislação aplicável. Qualquer autorização técnica e serviço adicional depende de concordância registrada.</p>
      <div className="grid grid-cols-2 gap-6 pt-8 text-center">
       <div className="border-t border-slate-900 pt-2">Assinatura do cliente</div>
       <div className="border-t border-slate-900 pt-2">Responsável pelo atendimento</div>
      </div>
     </div>}
     <div className="mt-4 border-2 border-slate-900 p-2 text-center text-[0.9em] font-extrabold uppercase">{document.disclaimer}</div>
     <p className="mt-3 text-center text-[0.9em]">Documento gerado a partir de registros internos do HB Studio.</p>
    </article>
    <div className="hb-print-actions rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
     <ShieldAlert className="mr-2 inline h-4 w-4"/>Se utilizar bobina térmica, configure também a largura no driver da impressora e desative cabeçalho/rodapé do navegador. O comprovante interno não é documento fiscal.
    </div>
   </>}
  </div>
 </RootShellLayout>;
}
