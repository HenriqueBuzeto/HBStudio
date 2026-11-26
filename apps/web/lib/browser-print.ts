/** Browser-native printing, isolated to this browser profile/terminal. No browser API controls the spooler. */
export type PrinterPaper = "58" | "80" | "A4";
export type BrowserPrintSettings = {
  paper: PrinterPaper;
  autoPrintQuote: boolean;
  autoPrintService: boolean;
  autoPrintSale: boolean;
  copies: 1 | 2;
};
export const PRINT_SETTINGS_KEY = "hbstudio:browser-print-settings:v2";
const legacyPaperKey = "hbstudio:printer-paper:v1";
export const DEFAULT_PRINT_SETTINGS: BrowserPrintSettings = {
  paper:"80",autoPrintQuote:false,autoPrintService:false,autoPrintSale:false,copies:1
};
const validPaper=(s:unknown):s is PrinterPaper=>s==="58"||s==="80"||s==="A4";
export function getBrowserPrintSettings():BrowserPrintSettings {
  if(typeof window==="undefined")return {...DEFAULT_PRINT_SETTINGS};
  try {
    const raw=localStorage.getItem(PRINT_SETTINGS_KEY);
    const saved=raw ? JSON.parse(raw) as Partial<BrowserPrintSettings> : {};
    const oldPaper=localStorage.getItem(legacyPaperKey);
    const paper=validPaper(saved.paper) ? saved.paper : validPaper(oldPaper) ? oldPaper : "80";
    return {paper,
      autoPrintQuote:saved.autoPrintQuote===true,
      autoPrintService:saved.autoPrintService===true,
      autoPrintSale:saved.autoPrintSale===true,
      copies:saved.copies===2?2:1};
  } catch {return {...DEFAULT_PRINT_SETTINGS};}
}
export function saveBrowserPrintSettings(value:BrowserPrintSettings):boolean {
  if(typeof window==="undefined")return false;
  const safe:BrowserPrintSettings={
    paper:validPaper(value.paper)?value.paper:"80",
    autoPrintQuote:value.autoPrintQuote===true,
    autoPrintService:value.autoPrintService===true,
    autoPrintSale:value.autoPrintSale===true,
    copies:value.copies===2?2:1
  };
  try {
    localStorage.setItem(PRINT_SETTINGS_KEY,JSON.stringify(safe));
    localStorage.setItem(legacyPaperKey,safe.paper);
    return true;
  } catch {return false;}
}
/** Preview only: receipt routes must authorize and verify a persisted record server-side. */
export function buildPrintUrl(kind:"quote"|"training"|"training-sale"|"service"|"contract"|"sale",id:string,paper?:PrinterPaper,auto=false) {
  const q=new URLSearchParams({kind,id});
  if(paper)q.set("paper",paper);
  if(auto)q.set("auto","1");
  return "/documents/print?"+q.toString();
}
