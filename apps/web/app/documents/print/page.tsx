"use client";

import {useEffect,useState} from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {Printer,FileDown,MessageCircle,RefreshCw,AlertTriangle,FileText,ShieldAlert} from "lucide-react";

type Paper="58"|"80"|"A4";
type Document={
 kind:"quote"|"service"|"contract";documentType:string;number:string;issuedAt:string;
 organization:{name:string;legalName:string;branch:string;cnpj:string|null;address:string};
 customer:string;items:Array<{sku?:string;description:string;quantity:number;unitPrice:number;discount:number;category?:string}>;
 totals:{subtotal:number;discount:number;shipping:number;total:number};
 validUntil?:string;paymentTerms?:string|null;notes?:string|null;disclaimer:string;
 detail?:{equipment:string;defect:string;condition:string|null;diagnostic:string|null;
 resolution:string|null;legalWarrantyDays:number;additionalWarrantyDays:number};
};
const money=(value:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);
const date=(value:string)=>new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(value));
const paperOptions:{code:Paper;name:string}[]=[
 {code:"80",name:"Bobina 80 mm"},{code:"58",name:"Bobina 58 mm"},{code:"A4",name:"Folha A4"}
];
export default function DocumentPrintPage(){
 const [document,setDocument]=useState<Document|null>(null);
 const [kind,setKind]=useState(""),[id,setId]=useState("");
 const [paper,setPaper]=useState<Paper>("80");
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [reference,setReference]=useState("");
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  const docKind=params.get("kind")||"";
  const docId=params.get("id")||"";
  const requestedPaper=params.get("paper");
  setKind(docKind);setId(docId);
  setPaper(docKind==="contract"?"A4":requestedPaper==="58"||requestedPaper==="80"||requestedPaper==="A4"?requestedPaper:"80");
  if(!["quote","service","contract"].includes(docKind)||!/^[a-f\d-]{36}$/i.test(docId)){
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
 const isContract=kind==="contract";
 const effectivePaper=isContract?"A4":paper;
 const title=kind==="quote"?"ORÇAMENTO COMERCIAL":kind==="contract"?"MINUTA DE TERMO DE SERVIÇO":"ORDEM DE SERVIÇO";
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
      padding:${effectivePaper==="A4"?"0":"3mm 2mm"}!important;
      width:${effectivePaper==="A4"?"100%":effectivePaper==="80"?"76mm":"54mm"}!important;
      max-width:none!important;min-height:auto!important;background:#fff!important;
      color:#000!important;overflow:visible!important;print-color-adjust:exact;}
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
    <div className="hb-print-actions space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
     <div className="flex flex-wrap gap-2">
      {paperOptions.filter(p=>!isContract||p.code==="A4").map(option=>
       <button type="button" key={option.code} onClick={()=>setPaper(option.code)}
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
    </div>
    <article id="hb-printed-document" className={"mx-auto border border-slate-200 bg-white p-5 text-slate-900 shadow-sm "+(effectivePaper==="A4"?"max-w-[210mm]":"")} style={{width:effectivePaper==="A4"?"100%":effectivePaper==="80"?"80mm":"58mm",fontSize:effectivePaper==="58"?10:effectivePaper==="80"?12:14,overflowWrap:"anywhere"}}>
     <div className="border-b-2 border-slate-900 pb-3 text-center">
      <h2 className="font-black uppercase">{document.organization.name}</h2>
      {document.organization.cnpj&&<p>CNPJ: {document.organization.cnpj}</p>}
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
     <table className="w-full border-collapse text-left" style={{tableLayout:"fixed"}}>
      <thead><tr className="border-b border-slate-600"><th className="py-2" style={{width:"56%"}}>Descrição</th><th className="text-center">Qtd.</th><th className="text-right">Total</th></tr></thead>
      <tbody>{document.items.map((item,i)=><tr key={i} className="border-b border-dotted border-slate-300 align-top">
       <td className="py-2">{item.description}{item.sku&&<span className="block text-[0.85em]">{item.sku}</span>}</td>
       <td className="py-2 text-center">{item.quantity}</td>
       <td className="py-2 text-right">{money(item.quantity*item.unitPrice-item.discount)}</td>
      </tr>)}</tbody>
     </table>
     <div className="mt-4 space-y-1 border-t border-dashed border-slate-600 pt-2 text-right">
      <p>Subtotal: {money(document.totals.subtotal)}</p>
      {document.totals.discount>0&&<p>Descontos: − {money(document.totals.discount)}</p>}
      {document.totals.shipping>0&&<p>Frete: {money(document.totals.shipping)}</p>}
      <p className="mt-2 border-t border-slate-600 pt-2 text-[1.15em] font-black">TOTAL: {money(document.totals.total)}</p>
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
     <div className="mt-6 border-2 border-slate-900 p-2 text-center text-[0.9em] font-extrabold uppercase">{document.disclaimer}</div>
     <p className="mt-3 text-center text-[0.9em]">Documento gerado a partir de registros internos do HB Studio.</p>
    </article>
    <div className="hb-print-actions rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
     <ShieldAlert className="mr-2 inline h-4 w-4"/>Se utilizar bobina térmica, configure também a largura no driver da impressora e desative cabeçalho/rodapé do navegador. O comprovante interno não é documento fiscal.
    </div>
   </>}
  </div>
 </RootShellLayout>;
}
