import {z} from 'zod';
const id=z.union([z.uuid(),z.literal('')]).default('');
export const taskStatuses=[['todo','Pendiente'],['in_progress','En curso'],['done','Completada'],['cancelled','Cancelada']] as const;
export const taskPriorities=[['low','Baja'],['medium','Normal'],['high','Alta'],['urgent','Urgente']] as const;
export const workTaskSchema=z.object({title:z.string().trim().min(1,'Escribe el título.').max(200),description:z.string().trim().max(10000).default(''),owner_id:id,deadline:z.union([z.iso.datetime({offset:true}),z.literal('')]).default(''),status:z.enum(taskStatuses.map(s=>s[0])),priority:z.enum(taskPriorities.map(s=>s[0])),client_id:id,event_id:id,talent_id:id,proposal_id:id,lead_id:id,opportunity_id:id});
export type WorkTaskFields=z.infer<typeof workTaskSchema>;
export type WorkTask=WorkTaskFields&{id:string;version:number;completed_at:string|null;deleted_at:string|null};
export const newTask=():WorkTaskFields=>({title:'',description:'',owner_id:'',deadline:'',status:'todo',priority:'medium',client_id:'',event_id:'',talent_id:'',proposal_id:'',lead_id:'',opportunity_id:''});
export const taskOverdue=(t:WorkTaskFields,now=new Date())=>!['done','cancelled'].includes(t.status)&&!!t.deadline&&Date.parse(t.deadline)<now.getTime();
