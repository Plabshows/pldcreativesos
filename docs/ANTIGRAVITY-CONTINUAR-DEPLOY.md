# Continuar publicación de Performance Lab OS

Trabaja sobre `/Users/manuel/Documents/Codex/2026-09-09/vam/work/performance-lab-os`.
Lee AGENTS.md y `docs/AUDIT-2026-09-21.md`. Comprueba el estado actual antes de modificar nada.

El commit local comprobado es `12492bbc25b7f796254d021690d7ff4c3cbda34f`.
El checkout estaba limpio al inicio de la verificación. No sincronices a ciegas con `performance-lab-os-clean` ni sobrescribas cambios posteriores.

## Qué está hecho

- Las correcciones de seguridad, referencias de inventario y cálculo de proveedores están guardadas en ese commit.
- Las migraciones `202609210002`, `202609210003` y `202609210004` ya se aplicaron y registraron en Supabase `jggoimqcrpqarhaojrva`. Comprueba su estado; no las repitas.
- Los dos workspaces se mantienen. No reconstruyas su sistema ni copies datos entre ellos.
- Última comprobación: 78/78 pruebas pasan al ejecutar `npm test` sin compilar simultáneamente. El build también pasó. Hubo dos timeouts de 5 segundos al ejecutar tests y build en paralelo; no fallaron aserciones funcionales.

## Bloqueo pendiente

Vercel sigue publicando la versión anterior, despliegue Ready `dpl_HhLZn2kp9AJAE2j9QH5Fy4BZyvF7`, en https://performance-lab-os.vercel.app.
Se verificó que su JavaScript aún no incluye «Saldo de asignaciones», texto de la nueva ficha de inventario.

Nuevo intento autorizado: `dpl_77sypMn26xC37DcBKZabxc2Zh9xT`.
Detalle: https://vercel.com/performancelabagency-4875s-projects/performance-lab-os/77sypMn26xC37DcBKZabxc2Zh9xT
La respuesta contiene `readyState: BLOCKED`, aunque el mensaje de la CLI diga «ready». No confundas el texto de éxito con el estado real.

La restricción anterior era `TEAM_ACCESS_REQUIRED`, por falta de permiso del autor del commit. Iniciar sesión en el navegador no soluciona por sí solo la vinculación del autor de Git.

## Objetivo

1. Verifica mediante Vercel API el motivo vigente del bloqueo, la cuenta CLI, el equipo, el proyecto y la identidad real del autor de Git.
2. Resuelve la vinculación legítima de GitHub/Vercel o pide a Manuel únicamente la acción concreta necesaria en su cuenta. No falsifiques autores, no elimines metadatos para eludir controles y no contrates un plan de pago sin autorización.
3. Despliega los cambios existentes en el mismo proyecto Vercel. No uses Netlify ni crees otro proyecto.
4. Comprueba `readyState=READY` y la asignación del dominio principal al nuevo despliegue. Un 200 de una pantalla de login de Vercel no acredita publicación.
5. Valida con sesión Eventos, Inventario y el selector de ambos espacios; sin sesión, comprueba que las API de negocio rechazan acceso. En inventario deben aparecer «Importes asignados al material» y «Saldo de asignaciones».
6. Actualiza la auditoría con el resultado y entrega el enlace, versión y limitaciones reales. No afirmes que se resolvieron reservas concurrentes o el sistema financiero completo: siguen en el roadmap.

No repitas builds/tests si no cambió el código ni existen fallos nuevos. No borres datos ni recalcules importes históricos. El primer objetivo de esta continuación es terminar y verificar la publicación que quedó pendiente.
