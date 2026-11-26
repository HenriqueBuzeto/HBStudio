import {z} from "zod";
// PostgreSQL accepts canonical hexadecimal UUIDs regardless of version/variant.
// Seeded ERP identifiers are not RFC version/variant UUIDs; tenant and permission checks remain in SQL.
const id=z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const optId=z.union([id,z.literal("")]).optional().default("");
const money=z.number().int().min(0).max(100000000000);
const version=z.string().min(1).max(100);
const secret=z.string().min(12).max(128);
const named={name:z.string().trim().min(2).max(100),description:z.string().max(500).optional().default("")};
export const governanceSchemas=z.discriminatedUnion("action",[
 z.object({action:z.literal("POSITION"),payload:z.object({...named,id:optId,version:version.optional(),code:z.string().trim().max(30).optional().default(""),level:z.enum(["EXECUTIVE","MANAGEMENT","OPERATIONAL","OTHER"]).optional().default("OTHER"),recommendedRoleId:optId,active:z.boolean().optional().default(true)})}),
 z.object({action:z.literal("CENTER"),payload:z.object({...named,name:z.string().trim().min(2).max(150),code:z.string().trim().min(1).max(50)})}),
 z.object({action:z.literal("ROLE"),payload:z.object({...named,id:optId,version:version.optional(),permissions:z.array(z.string().min(1).max(150)).min(1).max(500)})}),
 z.object({action:z.literal("USER"),payload:z.object({id:optId,version:version.optional(),name:z.string().trim().min(2).max(200),email:z.string().trim().email().max(250),positionId:optId,centerId:optId,partnerId:optId,roleIds:z.array(id).max(100),phone:z.string().max(40),notes:z.string().max(1000),admissionDate:z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/),z.literal("")]),baseCents:money.optional(),capCents:money.optional(),monthlyCents:money.optional(),expectedComp:z.object({baseCents:money.nullable(),capCents:money.nullable(),monthlyCents:money.nullable()}).optional(),password:secret.optional()})}),
 z.object({action:z.literal("PASSWORD"),payload:z.object({id,version,password:secret})}),
 z.object({action:z.literal("STATUS"),payload:z.object({id,version,active:z.boolean()})})
]);
const fieldMessages:Record<string,string>={id:"Identificador do registro inválido. Atualize a lista.",version:"Versão do cadastro inválida. Atualize antes de editar.",name:"Informe um nome válido, com pelo menos 2 caracteres.",description:"A descrição deve ter até 500 caracteres.",code:"Revise o código interno informado.",level:"Selecione um nível organizacional válido.",recommendedRoleId:"Selecione um perfil de acesso sugerido válido.",active:"Situação inválida.",email:"Informe um e-mail válido.",positionId:"Selecione um cargo válido.",centerId:"Selecione um setor válido.",partnerId:"Selecione um sócio válido.",roleIds:"Revise os perfis de acesso selecionados.",permissions:"Selecione permissões válidas.",phone:"O telefone deve ter até 40 caracteres.",notes:"As observações devem ter até 1.000 caracteres.",admissionDate:"Informe uma data válida.",baseCents:"Revise a remuneração-base.",capCents:"Revise o teto de pró-labore.",monthlyCents:"Revise a parcela mensal.",expectedComp:"Atualize os dados de remuneração antes de salvar.",password:"A senha deve ter entre 12 e 128 caracteres."};
export function governanceValidationMessage(error:z.ZodError):string{
 const issue=error.issues[0];
 if(!issue)return "Revise os campos obrigatórios.";
 const field=issue.path[0]==="payload"?String(issue.path[1]??""):"";
 return fieldMessages[field]||"Revise os dados da operação e tente novamente.";
}
