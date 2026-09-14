# Capa de contexto ChatGPT · fase 1

Implementada en local. No requiere API de IA, claves de IA, envío de correos ni despliegue en Netlify.

## Uso

Abrir una ficha guardada de Lead, Oportunidad, Propuesta, Cliente o Evento y pulsar su botón contextual. Elegir una de ocho acciones y pregunta opcional. Generar el contexto, verlo y editarlo si hace falta. Copiar y abrir ChatGPT copia el texto exacto y abre `https://chatgpt.com/` sin datos en la URL. El usuario pega el texto y continúa allí. No se automatizan clics, envío ni escritura en ChatGPT.

Se usan registros guardados. Lead/oportunidad/propuesta con cambios locales deben guardarse antes de preparar contexto. Al cambiar acción, pregunta o privacidad se invalida el texto anterior y debe regenerarse. Cerrar destruye el contexto del modal; no se guarda en localStorage ni se registra en la base de datos.

Si el portapapeles falla, se muestra el texto, el botón Copiar prompt y la selección manual. Si el navegador bloquea la nueva pestaña, queda disponible un enlace explícito a ChatGPT.

## Capas

- UI: `components/chatgpt-context-button.tsx`, un único componente en todas las fichas.
- Contrato validado: `lib/chatgpt/contracts.ts`, entityType/entityId/action/customQuestion/includePersonalData.
- Permisos: `lib/server/chatgpt/permissions.ts` y la sesión/organización de requireOrganization.
- Acceso a datos: `lib/server/chatgpt/repository.ts`, tablas internas permitidas, filtros por organización en todas las consultas, RLS del usuario y paginación.
- Servicios: getClientContext, getLeadContext, getProposalContext, getEventContext y getOpportunityContext en `context-service.ts`.
- Construcción pura: `lib/chatgpt/build-context.ts`. Formato común sin campos vacíos, fuentes enlazadas y cálculos con importes conocidos.
- Privacidad: `lib/chatgpt/privacy.ts`, proyección por lista de campos y filtrado de contactos/direcciones.
- Portapapeles/apertura: `lib/chatgpt/clipboard.ts`.
- API interna: POST `/api/chatgpt-context`, lectura autenticada, sin caché ni cambios de negocio. Rechaza organizaciones arbitrarias, entidades no permitidas y registros inexistentes/inaccesibles. No acepta instrucciones SQL ni nombres libres de tablas.

## Relaciones y precisión

Se resuelve el registro original antes de leer relaciones. Propuesta → oportunidad → lead; cliente; evento; shows y asignaciones de artistas; pagos existentes; tareas y actividad. Las fichas relacionadas aparecen una sola vez. El historial adicional del cliente se resume sin desarrollar los artistas de cada evento histórico salvo que el cliente sea el registro principal.

No se vinculan entidades por parecido de nombres. No se deduce disponibilidad de una asignación, ni se sustituyen importes desconocidos por cero. Las versiones anteriores de propuestas no se reconstruyen porque no hay historial de documentos almacenado. Las alternativas de presupuesto no se suman. Se distingue información interna y borrador para cliente mediante instrucciones explícitas.

## Privacidad

Los datos personales están desactivados al abrir cada modal. No se proyectan emails/teléfonos; nunca se proyecta información fiscal, medidas físicas del artista, tokens ni claves. Se filtran valores de contacto conocidos y patrones de email/teléfono/direcciones en textos libres. Es una protección conservadora, no una garantía de detección de toda dirección informal: el modal pide revisar los textos antes de copiar. La vista previa es exactamente lo que se copia, incluidas las ediciones que haga el usuario.

Los costes y notas internas sí forman parte del contexto solicitado; se advierte de ello. Activar la casilla habilita el contacto del cliente/lead. Nunca se envía el prompt automáticamente a un tercero.

## Fase 2 (no implementada)

Un futuro adaptador autenticado (por ejemplo, OAuth con permisos granulares) puede llamar a estos servicios en nombre de un miembro del equipo. Debe validar organización y permisos antes del acceso y aplicar la política de privacidad de esa solicitud. No publicar la sesión interna ni usar service-role para saltarse RLS.

Separar futuros permisos de lectura de clientes, eventos y costes. Las acciones de escritura seguirán en los servicios actuales del OS; cualquier futura integración deberá proponer una acción estructurada, mostrar su resultado previsto y obtener aprobación antes de ejecutarla. No se ha creado ningún endpoint de escritura desde ChatGPT ni endpoint público sin autenticar.

## Verificación

Pruebas de limpieza, privacidad por defecto/opcional, importes/fechas, relaciones sin duplicados, registro inaccesible y orden copia/apertura con fallo del portapapeles. API autenticada real devuelve contexto de evento y cliente; registro no disponible 404, acceso anónimo 401. No se han enviado prompts reales a ChatGPT durante las pruebas.

La compilación y pruebas automáticas pasan. El flujo visual interactivo de portapapeles/pestaña se valida al usarlo en el navegador; no se afirma una prueba visual de este flujo en esta sesión.
