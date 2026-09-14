# CRM incremental · fase A

Estado: CRM conectado a Supabase el 13 de septiembre de 2026, por autorización expresa de Manuel. No desplegado en Netlify. Netlify solo se desplegará cuando Manuel lo pida expresamente.

## Trabajar con datos compartidos

Abrir http://127.0.0.1:3000/#leads o http://127.0.0.1:3000/#pipeline e iniciar sesión con el usuario habitual. Estas pantallas usan Supabase y los clientes, eventos y miembros del mismo espacio de trabajo. La aplicación publicada en Netlify conserva su versión anterior.

## Principios

Eventos, Shows, Clientes y Talento siguen siendo el núcleo existente. La fase A solo añade Leads al menú y sustituye el placeholder de Pipeline. No copia registros del núcleo ni crea otra tabla de eventos. Estrategia completa: PROJECT-STRATEGY.md.

## Probar ahora

Con el servidor de desarrollo activo, abrir http://127.0.0.1:3000/crm-preview.

La prueba comienza vacía. Permite crear consultas, editarlas, convertirlas en oportunidades, mover tarjetas o cambiar el estado con el selector, registrar actividad y consultar alertas. Sus registros viven en localStorage bajo plab-crm-local-preview-v1 y NO se sincronizan automáticamente con Supabase. El responsable «Yo · prueba local» solo identifica este modo, no crea un usuario. Para trabajar con clientes y responsables reales, usar las pantallas compartidas anteriores. La ruta de prueba está desactivada en compilación de producción.

## Conexión activada

/api/crm utiliza la sesión actual y su organización. La migración 202609130008_crm_essentials.sql crea leads y client_contacts si faltan, amplía leads y añade opportunities y crm_activities. Mantiene el stage antiguo del lead y añade crm_stage para evitar romper integraciones anteriores. Conserva el lead al crear una oportunidad, impide duplicarla mediante una restricción única y reúne ambas actividades en la ficha de la oportunidad.

Los estados y la actividad se registran en la misma transacción mediante triggers. Las referencias de clientes, contactos, responsables y eventos se validan con enforce_tenant_references. Los permisos se limitan a admin, producer y sales; no se usa una service key en el cliente. GET devuelve un aviso de configuración pendiente si faltan tablas/columnas. No existe fallback silencioso de datos compartidos a datos locales.

Aplicada a jggoimqcrpqarhaojrva mediante el editor SQL, consulta 1b103a34-2bbe-4beb-860e-e1b0b423a335. La comprobación previa encontró que leads, client_contacts y set_updated_at no existían. Se adaptó la migración y se probó tanto con el esquema histórico como con el reparado. No volver a ejecutar esta migración completa sobre la misma base.

Verificación real con transacción revertida: alta de lead/oportunidad, estado ganado, actividad, rechazo de oportunidad duplicada, lectura y edición por el segundo administrador y aislamiento de un usuario ajeno. No se conservaron registros de prueba. Recuentos anteriores: 484 clientes, 234 eventos, 58 artistas.

## Incluido

- Leads y oportunidades con contacto, origen, fecha, ubicación, presupuesto, propietario, notas y siguiente acción.
- Diez etapas del pipeline; arrastre y selector accesible, búsqueda y filtro por responsable/seguimiento.
- Avisos de inactividad a 3, 7 y 14 días, próxima acción incompleta y vencida.
- Historial de actividad y cambios de estado. Registrar actividad reinicia el contador; editar notas o la próxima acción no simula una conversación.
- Totales del pipeline abierto y ponderación por probabilidad.
- Motivo de pérdida opcional y enlace de una oportunidad ganada a un evento existente (preparado para Supabase, no disponible en la prueba local).

## Pendiente por fases

- Conversión de lead a cliente/contacto con revisión de coincidencias (no automática).
- Fase B: propuestas con shows existentes, aceptación/ganado → creación idempotente de evento, forecast 30/90 días y extensión de timeline a la ficha del cliente.
- Fases C–G: salud/disponibilidad/conflictos, tareas, cobros, automatizaciones, integraciones y Ask Lab, según PROJECT-STRATEGY.md.

Validación local: TypeScript, build, reglas CRM y ejecución de migración en PostgreSQL embebido PGlite. El test de migración usa un esquema mínimo y no reemplaza una validación de permisos con el esquema real de Supabase.
