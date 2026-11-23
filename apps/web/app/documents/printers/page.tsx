"use client";

import {useEffect,useState} from "react";
import RootShellLayout from "@/components/RootShellLayout";
import {Printer,CheckCircle2,Info,MonitorSmartphone,FileText} from "lucide-react";

type Paper="58"|"80"|"A4";
const settingsKey="hbstudio:printer-paper:v1";
export default function PrinterSetupPage(){
 const [paper,setPaper]=useState<Paper>("80");
 const [saved,setSaved]=useState(false);
 useEffect(()=>{const v=localStorage.getItem(settingsKey);if(v==="58"||v==="80"||v==="A4")setPaper(v);},[]);
 const save=(v:Paper)=>{setPaper(v);localStorage.setItem(settingsKey,v);setSaved(true);};
 const testPrint=()=>window.print();
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
   <div className="rounded-2xl border border-slate-200 bg-white p-5">
    <h1 className="flex items-center gap-2 text-lg font-black"><Printer className="h-5 w-5 text-violet-700"/>Configuração de impressoras</h1>
    <p className="mt-2 text-xs text-slate-600">O HB Studio utiliza a impressora instalada no sistema operacional. Para bobinas térmicas de 58 mm e 80 mm, selecione o tamanho correto no driver e faça um teste antes do atendimento.</p>
   </div>
   <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="font-bold text-slate-900">Tamanho padrão deste computador</h2>
    <div className="flex flex-wrap gap-2">{(["58","80","A4"] as Paper[]).map(p=>
     <button key={p} onClick={()=>save(p)}
      className={"rounded-xl border px-4 py-2 text-xs font-bold "+(p===paper?"border-violet-700 bg-violet-50 text-violet-700":"border-slate-200")}>{p==="A4"?"Folha A4":`Bobina ${p} mm`}</button>)}</div>
    {saved&&<p role="status" className="flex items-center gap-2 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4"/>Preferência salva neste navegador.</p>}
    <button onClick={testPrint} className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-xs font-bold text-white"><Printer className="h-4 w-4"/>Imprimir comprovante de teste</button>
    <p className="text-xs text-slate-500">Na primeira impressão, selecione a impressora e o tamanho da mídia no Windows/macOS. Desative cabeçalhos e rodapés do navegador. A seleção da impressora é feita pelo diálogo do sistema, não automaticamente pelo site.</p>
   </section>
   <article id="hb-printer-test" className="mx-auto border border-dashed border-slate-400 bg-white p-3 text-center text-slate-900" style={{width:paper==="A4"?"100%":paper==="80"?"80mm":"58mm",overflowWrap:"anywhere"}}>
    <h3 className="font-black">HB STUDIO</h3>
    <p>TESTE DE IMPRESSÃO</p>
    <p className="mt-2">PAPEL: {paper==="A4"?"A4":paper+" mm"}</p>
    <p>------------------------------------</p>
    <p>LETRAS: ABC abc 123 ç ã é</p>
    <p>R$ 1.234,56</p>
    <p>------------------------------------</p>
    <p className="mt-2 font-bold">Isto NÃO é cupom fiscal.</p>
    <p>Fim do teste.</p>
   </article>
   <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
    <p className="flex gap-2"><Info className="h-4 w-4 shrink-0"/>Impressão automática sem diálogo não pode ser garantida pelo navegador. Para atendimento de alto volume, a etapa seguinte é integrar um agente local assinado (por exemplo, QZ Tray) e validar cada modelo de impressora.</p>
    <p className="flex gap-2"><MonitorSmartphone className="h-4 w-4 shrink-0"/>O PDF é gerado pelo destino “Salvar como PDF” no diálogo de impressão. O compartilhamento pelo WhatsApp abre a mensagem; enviar o anexo automaticamente exige API oficial e consentimento.</p>
    <p className="flex gap-2"><FileText className="h-4 w-4 shrink-0"/>Orçamentos, OS e minutas de contrato são documentos internos. Nenhum dos comprovantes de teste representa pagamento confirmado ou autorização SEFAZ.</p>
   </div>
  </div>
 </RootShellLayout>;
}
