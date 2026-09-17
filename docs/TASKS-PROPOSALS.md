# Tareas y propuestas · 13 septiembre 2026

Activadas en la aplicación local y en Supabase. No se ha desplegado en Netlify.

## Flujo

- Pipeline → Crear propuesta: usa la oportunidad y el cliente existente.
- Propuestas → Nueva: cliente existente o nombre manual para una consulta, fecha, venue, idioma, concepto y condiciones.
- Una o varias alternativas independientes. Cada partida puede agrupar varios shows del catálogo con los mismos artistas, para cambios de vestuario sin cobrar cada pase de nuevo. Los pases y la duración describen el alcance, no multiplican el precio por evento.
- Tarifas por artista/evento, artista/día, equipo/paquete y unidades. Cantidad, días/unidades, venta y coste tienen bases explícitas. El coste puede ser del equipo completo o por unidad.
- Descuento por opción. IVA nullable sin porcentaje por defecto. Vacío no significa cero. Con venta incompleta se muestra subtotal conocido; con coste incompleto no se muestra beneficio definitivo.
- Vista del cliente, texto copiable y PDF descargable. Ambos se construyen con una proyección pública explícita que excluye costes, notas internas y márgenes. Rótulos ES/EN; los textos introducidos por el usuario no se traducen automáticamente.
- Estados manuales: borrador, lista, enviada, vista, seguimiento, aceptada, rechazada, caducada. Copiar/descargar no envía mensajes ni presume lectura.
- Aceptada + opción elegida + precios + cliente existente + fecha → evento original, importe antes de impuestos y shows vinculados. Conversión en transacción con bloqueo de fila. Si la oportunidad ya tiene evento, se reutiliza sin sobrescribir su economía.
- Seguimiento → nueva tarea vinculada a la propuesta. Tareas tiene lista/tablero, prioridades, responsables, vencimiento, filtros, completar/reabrir, archivo/restauración y relaciones con clientes, eventos, artistas, leads, oportunidades y propuestas.
- Mi día y contador de tareas consultan datos compartidos. Cambios concurrentes en fichas se rechazan mediante versión para evitar sobrescrituras silenciosas.

## Fuentes comerciales

Habilidad `performance-lab-presupuestos`, referencias aportadas por Manuel el 8/09/2026. Historial consultado: «Presupuesto Fire Girls» (coste de equipo frente a venta por artista y corrección de precio específica), «Presupuesto Performers Dubái» (resumen de intercambio; se usa solo para el patrón de paquetes con varios personajes, no como tarifa ni compromiso). No se ha importado ninguna conversación como cliente/propuesta real.

Las referencias de precio son opcionales y orientativas hasta que Manuel las revise. No se aplican costes históricos a futuros eventos. No se presume un porcentaje de IVA, margen, depósito ni mínimo de artistas.

## Esquema

`202609130009_tasks_proposals.sql` aplicada tras inspección del esquema vivo y dry-run revertido. La tabla proposals guarda una instantánea JSON validada de opciones/partidas y referencias relacionales a cliente, oportunidad, evento y responsables. Los shows mantienen sus IDs originales y se comprueban por organización. No se duplica catálogo ni eventos.

Tareas se amplía con relaciones faltantes, fecha de finalización y versión. Se sustituye la política amplia tasks_all por lectura/alta/edición del equipo comercial y producción. FK de ambas entidades validadas por organización; sin service key en el navegador.

## Verificación

- Pruebas de dominio: precios por equipo vs artista, pases incluidos, días, IVA/descuento, alternativas, importes desconocidos, aceptación, privacidad del texto y PDF multipágina, estados/vencimiento de tareas.
- Transacción en Supabase revertida: esquema, conversión, total, show vinculado, idempotencia, acceso de Sara y aislamiento de usuario ajeno.
- API autenticada real: guardar, editar, aceptar, convertir dos veces sin duplicar, crear/completar tarea, rechazos 409 a versiones antiguas, PDF HTTP 200. Registros temporales eliminados al terminar; verificación final 0 propuestas, 0 tareas, 234 eventos y 484 clientes.
- PDF de QA renderizado en dos páginas: márgenes y saltos correctos; extracción sin marcador privado ni importe de coste.
- Build y TypeScript. Control visual interactivo del navegador no disponible en esta sesión; no se afirma una prueba visual de los formularios.

## Límites explícitos

No hay envío automático de WhatsApp/email, seguimiento real de apertura, firma electrónica ni integraciones externas. Los estados de propuesta son manuales. Los PDF se generan desde los campos actuales del editor; Guardar persiste esa versión en Supabase. Las tareas y propuestas comienzan vacías, sin datos inventados.
