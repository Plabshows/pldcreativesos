/** Phase 1 is read-only and uses the signed-in team member's RLS session. */
export const canReadChatGPTContext=(role:string)=>['admin','producer','sales'].includes(role);
export class ContextNotFound extends Error {constructor(){super('Registro no disponible en tu espacio de trabajo.');}}
