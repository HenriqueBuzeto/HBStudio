export function csvEscape(value:unknown,kind:string):string{
 let s=value==null?"":String(value);
 if(kind==="money"||kind==="qty"){
  if(!/^-?\d+(?:\.\d+)?$/.test(s))s="";else s=s.replace(".",",");
 }else if(/^[\s\uFEFF]*[=+@\-\t\r\n]/.test(s))s="'"+s;
 return '"'+s.replaceAll('"','""')+'"';
}
