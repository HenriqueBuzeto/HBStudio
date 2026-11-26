export type PosShortcutContext={tab:string;authorized:boolean;loading:boolean;saving:boolean;modalOpen:boolean};
export function canToggleTraining(context:PosShortcutContext):boolean{
 return context.tab==="pos"&&context.authorized&&!context.loading&&!context.saving&&!context.modalOpen;
}
export function isTrainingShortcut(event:Pick<KeyboardEvent,"key"|"ctrlKey"|"altKey"|"shiftKey"|"metaKey"|"repeat"|"isComposing"|"defaultPrevented">):boolean{
 return event.key==="F1"&&event.ctrlKey&&!event.altKey&&!event.shiftKey&&!event.metaKey&&!event.repeat&&!event.isComposing&&!event.defaultPrevented;
}
