import {z} from 'zod';
export const contextActions=[
 ['create-proposal','Crear propuesta','Crea una propuesta comercial clara, atractiva y profesional basándote en la información anterior.'],
 ['reply-client','Responder al cliente','Prepara una respuesta breve, natural y profesional para enviar al cliente.'],
 ['analyse-lead','Analizar lead','Analiza qué necesita el cliente, qué información falta, qué servicios podrían encajar y cuál debería ser el siguiente paso.'],
 ['review-budget','Revisar presupuesto','Comprueba precios, costes, margen, posibles inconsistencias y datos que deberían revisarse.'],
 ['suggest-ideas','Sugerir ideas','Propón conceptos y servicios apropiados para este evento utilizando los recursos disponibles de Performance Lab.'],
 ['missing-information','Detectar información que falta','Identifica la información que debería solicitarse al cliente antes de confirmar la propuesta.'],
 ['prepare-briefing','Preparar briefing','Crea un briefing operativo claro para los artistas y producción.'],
 ['free','Consulta libre','Responde a la pregunta del usuario utilizando el contexto disponible. Si no hay pregunta, resume la situación y los siguientes pasos.'],
] as const;
export const contextRequestSchema=z.object({entityType:z.enum(['lead','proposal','client','event','opportunity']),entityId:z.uuid(),action:z.enum(contextActions.map(a=>a[0])),customQuestion:z.string().trim().max(4000).default(''),includePersonalData:z.boolean().default(false)}).strict();
export type ContextRequest=z.infer<typeof contextRequestSchema>;
export type ContextRow=Record<string,unknown>;
export type ContextGraph={root:ContextRequest['entityType'];rootId:string;capturedAt:string;clients:ContextRow[];leads:ContextRow[];opportunities:ContextRow[];events:ContextRow[];proposals:ContextRow[];shows:ContextRow[];performers:ContextRow[];assignments:ContextRow[];payments:ContextRow[];activities:ContextRow[];tasks:ContextRow[];historyEvents:ContextRow[];historyProposals:ContextRow[]};
export type ContextResult={prompt:string;capturedAt:string;counts:Record<string,number>;includePersonalData:boolean};
