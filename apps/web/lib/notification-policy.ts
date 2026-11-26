export const NOTIFICATION_PERMISSIONS=["finance.payables.view","finance.receivables.view","inventory.view","repairs.view","purchases.view","cash.shift.view","manufacturing.view","fleet.view","crm.view"] as const;
export const NOTIFICATION_CATEGORIES={finance:"Financeiro",inventory:"Estoque",repairs:"Assistência técnica",purchases:"Compras",cash:"Caixa",manufacturing:"Fábrica 3D",fleet:"Frota",crm:"CRM"} as const;
export type NotificationCategory=keyof typeof NOTIFICATION_CATEGORIES;
export type ErpNotification={key:string;category:NotificationCategory;severity:"urgent"|"warning"|"info";title:string;description:string;href:string;eventAt:string;readAt:string|null};
export type NotificationFeed={items:ErpNotification[];total:number;unread:number;urgent:number;writable:boolean;checkedAt:string};
