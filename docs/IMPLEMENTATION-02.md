# Bloque 2: CRM persistente, acceso y coste cero

Autorizado el 11/09/2026: continuar el plan gratuito y centralizar las cuentas en plabcreatives@gmail.com, si Google permite registrar esa dirección. El alta requiere datos personales del titular: no se inventan. Ninguna cuenta está creada hasta verificar el resultado.

## Arquitectura actualizada

Conservamos React y Next.js. La aplicación se exporta como archivos estáticos para Cloudflare Pages Free. Supabase Auth gestiona sesiones; PostgreSQL valida, aísla, autoriza y registra las modificaciones mediante RLS, constraints y triggers. El navegador contiene únicamente la publishable key. No hay service_role, secretos ni datos comerciales precompilados. Los cambios críticos son transacciones de PostgreSQL. Se sustituye el proxy SSR por autenticación de cliente con JWT verificado por Supabase en cada operación.

## Modelo y flujos del bloque

- Identidad: auth.users → users → organization_members → organizations. Acceso por contraseña con cuentas creadas por el administrador. Solo el correo fundador verificado puede crear la organización inicial; el acceso se puede ampliar posteriormente a miembros existentes por UUID. No registro público en la UI.
- Clientes: clients → client_contacts. Alta/edición/archivado de la empresa y sus notas. Los contactos se conservan en su tabla. Próximo seguimiento y responsable se incluyen en la ficha.
- Eventos: events → clients y event_requirements. Alta/edición, checklist de producción, estado, fecha, ubicación y brief. Al confirmar, se crean pendientes una sola vez por evento mediante un trigger transaccional.
- Tareas: tasks → clients/events. Alta/edición/completar/reabrir/archivar, prioridad, plazo y responsable.
- Panel: métricas de registros reales. Sin importes, artistas o alertas ficticios. Búsqueda y filtros se aplican a registros autorizados; resultados paginados.

## Pantallas

Acceso/configuración cuando falta la conexión; panel diario; lista de clientes; lista de eventos; lista de tareas; formulario modal accesible y ajustes. La antigua maqueta permanece en /preview identificada como ejemplo, sin guardar datos.

## Pruebas necesarias

Migraciones ejecutadas en PostgreSQL embebido de pruebas, autenticación simulada exclusivamente en pruebas. Verificar bloqueo anónimo, aislamiento de organizaciones y relaciones, permisos por rol, restricciones de campos, auditoría y automatización idempotente. Compilar la exportación. La verificación contra Supabase y la publicación dependen del alta externa.

## Alcance pendiente

Este bloque entrega acceso + clientes + eventos + tareas. Talento completo, presupuestos PDF, importación, invitaciones por email, recuperación de contraseña por email, archivos, pagos y LAB AGENT siguen en el plan; no se muestran como implementados. No servicios de pago ni envío de mensajes externos.
