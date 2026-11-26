export type FactoryTransition={target:number;label:string;description:string};
export function factoryTransitions(status:number,capabilities:{execute:boolean;quality:boolean}):FactoryTransition[]{
 if(status===7&&capabilities.execute)return [{target:8,label:"Iniciar impressão",description:"Confirme a impressora e a duração estimada."}];
 if(status===8&&capabilities.execute)return [{target:10,label:"Concluir impressão",description:"Informe o consumo real, tempo e peças produzidas. Lotes incompletos retornam à fila."},{target:7,label:"Registrar falha / retornar à fila",description:"Registre o refugo e o motivo da falha. O consumo realizado será preservado."}];
 if(status===10&&capabilities.quality)return [{target:12,label:"Aprovar e concluir",description:"Confirme os materiais de montagem e as peças aprovadas."},{target:7,label:"Registrar rejeição / retrabalho",description:"Registre as peças rejeitadas e o motivo. A ordem retorna à fila se faltar produção."}];
 return [];
}
export function canMoveFactoryOrder(status:number,target:number,capabilities:{execute:boolean;quality:boolean}):boolean{return factoryTransitions(status,capabilities).some(x=>x.target===target);}
