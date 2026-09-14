# CRM · avance de ventas, 13 septiembre 2026

Disponible en local con Supabase. No desplegado en Netlify.

## Incluido

- Oportunidad guardada como Ganado → Crear evento en la tabla y pantalla existentes. Requiere cliente existente y fecha. Copia nombre, cliente, fecha, venue, ciudad, país, tipo, notas e importe estimado como ingreso editable. No inventa artistas, costes ni pagos.
- Recuperación de reintentos: ID estable y código EV-CRM por oportunidad; nunca sobrescribe un evento ya creado. La creación y el enlace son dos operaciones. Si falla el enlace, el mensaje permite reintentar recuperando el mismo evento. No es una transacción única.
- Enlace con evento existente validado por organización y no archivado; evita sustituir un enlace ya guardado. Crear eventos requiere admin o producer, igual que el tablero actual.
- Abrir ficha de evento desde la oportunidad; enlaces directos desde Mi día a una consulta u oportunidad.
- Mi día: resumen comercial real, seguimientos vencidos/de hoy/inactivos/incompletos, oportunidades ganadas sin evento, estados y previsión ponderada a 30/90 días según fecha de cierre. Los leads ya convertidos no duplican el seguimiento de su oportunidad.
- Previsión de 30/90 días también en Pipeline. Excluye ganados, perdidos y fechas anteriores a hoy; informa de oportunidades sin fecha.

## Verificación

- 14 pruebas automáticas: incluye recuperación de enlace fallido sin duplicación, validación previa, reutilización de evento y límites de forecast.
- Build y TypeScript correctos.
- Comprobación autenticada de las API locales contra Supabase: CRM y Eventos devuelven HTTP 200, 234 eventos y 484 clientes; CRM devuelve 2 miembros. POST anónimo rechazado con 401.
- Columnas utilizadas comprobadas mediante lectura autenticada en Supabase. No hizo falta migración y no se crearon datos de prueba en producción.
- Inspección visual pendiente: el control del navegador no respondió durante esta sesión.

## Pendiente

Propuestas con shows y aceptación → evento; conversión a cliente/contacto; resto de fases de PROJECT-STRATEGY.md. Este avance no completa toda la estrategia.
