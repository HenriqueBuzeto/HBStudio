"use client";
import {useEffect,useState} from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {Printer,CheckCircle2,Info,MonitorSmartphone,FileText,ShieldAlert} from "lucide-react";
import {type PrinterPaper,type BrowserPrintSettings,getBrowserPrintSettings,saveBrowserPrintSettings,DEFAULT_PRINT_SETTINGS} from "@/lib/browser-print";

export default function PrinterSetupPage(){
 const [settings,setSettings]=useState<BrowserPrintSettings>(DEFAULT_PRINT_SETTINGS);
 const [message,setMessage]=useState("");
 useEffect(()=>{setSettings(getBrowserPrintSettings());},[]);
 const change=(next:BrowserPrintSettings)=>{
  setSettings(next);
  setMessage(saveBrowserPrintSettings(next)?"Configuração salva somente neste navegador.":"Configuração aplicada nesta página; o navegador bloqueou o armazenamento.");
 };
 const testPrint=()=>window.print();
 const paper=settings.paper;
 const choosePaper=(v:PrinterPaper)=>change({...settings,paper:v});
 return <RootShellLayout>
  <style>{`
   @media print{
    @page{size:${paper==="A4"?"A4":"auto"};margin:${paper==="A4"?"12mm":"0"}}
    body *{visibility:hidden!important}
    #hb-printer-test,#hb-printer-test *{visibility:visible!important}
    #hb-printer-test{position:absolute!important;top:0;left:0;
      width:${paper==="A4"?"180mm":paper==="80"?"72mm":"48mm"}!important;
      margin:0!important;padding:2mm!important;border:0!important;
      box-shadow:none!important;font-size:${paper==="58"?"9px":"12px"}!important}
   }
  `}</style>
  <div className="mx-auto max-w-3xl space-y-5 pb-10">
   <header className="rounded-2xl border border-slate-200 bg-white p-5">
    <h1 className="flex items-center gap-2 text-lg font-black"><Printer className="h-5 w-5 text-violet-700"/>Impressora do caixa — Chrome / Edge</h1>
    <p className="mt-2 text-xs text-slate-600">Integração gratuita com o driver do Windows. O navegador abre a impressão e encaminha o trabalho à impressora escolhida. Para eliminar o diálogo, configure um navegador dedicado com impressão silenciosa conforme a política do terminal.</p>
   </header>
   <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="font-extrabold text-slate-900">Preferências deste computador</h2>
    <div className="flex flex-wrap gap-2">{(["58","80","A4"] as PrinterPaper[]).map(p=>
     <button type="button" key={p} aria-pressed={p===paper} onClick={()=>choosePaper(p)}
      className={"rounded-xl border px-4 py-2 text-xs font-bold "+(p===paper?"border-violet-700 bg-violet-50 text-violet-700":"border-slate-200")}>{p==="A4"?"Folha A4":`Bobina ${p} mm`}</button>)}</div>
    <div className="space-y-3 border-t border-slate-100 pt-4">
     <label className="flex items-start justify-between gap-3 text-sm">
      <span><strong>Imprimir orçamento automaticamente ao salvar</strong>
       <small className="mt-1 block text-xs text-slate-500">Somente depois da confirmação de persistência no Neon. Não registra venda nem pagamento.</small></span>
      <input type="checkbox" aria-label="Autoimpressão de orçamentos" checked={settings.autoPrintQuote} onChange={e=>change({...settings,autoPrintQuote:e.target.checked})}/>
     </label>
     <label className="flex items-start justify-between gap-3 text-sm">
      <span><strong>Imprimir OS automaticamente após cadastro</strong>
       <small className="mt-1 block text-xs text-slate-500">Configuração preparada para a conclusão da OS, sujeita à integração e aos testes autenticados.</small></span>
      <input type="checkbox" aria-label="Autoimpressão de ordens de serviço" checked={settings.autoPrintService} onChange={e=>change({...settings,autoPrintService:e.target.checked})}/>
     </label>
     <label className="flex items-start justify-between gap-3 text-sm">
      <span><strong>Autoimprimir simulações de PDV (vendas reais após homologação)</strong>
       <small className="mt-1 block text-xs text-amber-700">O cupom de treinamento abre após a simulação salva. Vendas reais somente após pagamento confirmado e documentação fiscal aplicável.</small></span>
      <input type="checkbox" aria-label="Autoimpressão de vendas quando homologadas" checked={settings.autoPrintSale} onChange={e=>change({...settings,autoPrintSale:e.target.checked})}/>
     </label>
    </div>
    {message&&<p role="status" className="flex items-center gap-2 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4"/>{message}</p>}
    <button type="button" onClick={testPrint} className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-xs font-bold text-white">
     <Printer className="h-4 w-4"/>Imprimir teste de bobina
    </button>
    <p className="text-xs text-slate-500">O HB Studio não identifica nem modifica o driver, a impressora padrão ou o sucesso físico do papel. Configure as margens e a mídia no Windows. Se o navegador bloquear a janela de impressão automática, use o botão manual no documento.</p>
   </section>
   <article id="hb-printer-test" className="mx-auto border border-dashed border-slate-400 bg-white p-3 text-center text-slate-900"
     style={{width:paper==="A4"?"100%":paper==="80"?"80mm":"58mm",overflowWrap:"anywhere"}}>
    <h3 className="font-black">HB STUDIO</h3><p>TESTE DE IMPRESSÃO</p>
    <p className="mt-2">PAPEL: {paper==="A4"?"A4":paper+" mm"}</p>
    <p>------------------------------------</p>
    <p>LETRAS: ABC abc 123 ç ã é</p><p>R$ 1.234,56</p><p>------------------------------------</p>
    <p className="mt-2 font-bold">TESTE — NÃO É DOCUMENTO FISCAL</p>
   </article>
   <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
    <p className="flex gap-2"><Info className="h-4 w-4 shrink-0"/>Para impressão com um clique, basta o driver e o navegador. Abertura automática ainda depende da política de pop-ups. Impressão sem diálogo depende da configuração do Chrome/Edge e utiliza a impressora padrão, inclusive quando o documento estiver em A4.</p>
    <p className="flex gap-2"><ShieldAlert className="h-4 w-4 shrink-0"/>Não configure impressão silenciosa no perfil que costuma imprimir PDFs em A4: o navegador pode enviar esses trabalhos à térmica. Um perfil exclusivo de PDV é a opção mais segura.</p>
    <p className="flex gap-2"><MonitorSmartphone className="h-4 w-4 shrink-0"/>Para PDF, utilize “Salvar como PDF” no diálogo. WhatsApp compartilha apenas resumo, sem anexar arquivo automaticamente.</p>
    <p className="flex gap-2"><FileText className="h-4 w-4 shrink-0"/>A configuração não altera as regras fiscais nem autoriza liquidação de vendas. Os recibos só podem representar operações persistidas e elegíveis.</p>
   </div>
  </div>
 </RootShellLayout>;
}
