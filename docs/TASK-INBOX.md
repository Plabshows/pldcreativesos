# Buzón personal de tareas

Disponible en Mi día y en la campana global. Solo muestra tareas abiertas asignadas al usuario autenticado. Priorización: vencidas, novedades, urgencia y fecha. «Nueva / actualizada» significa que la versión actual no se ha marcado como vista. «Marcar vista» no completa la tarea; abrir su ficha permite completarla con el flujo existente.

La vista Mis tareas abre Tareas con el filtro del usuario. El buzón se actualiza al guardar tareas desde el OS, al recuperar el foco y cada 30 segundos mientras la pestaña está visible. No es un servicio de notificaciones push.

Persistencia compartida entre dispositivos mediante `task_inbox_receipts` (task_id/user_id/seen_version). Solo la persona asignada puede marcar su versión actual como vista; el servidor determina usuario y organización. Un cambio de versión posterior vuelve a generar novedad. Reasignar, completar, cancelar o archivar cambia automáticamente las tareas incluidas.

Migración `202609130010_task_inbox.sql` aplicada tras comprobar esquema y ensayo revertido. La prueba confirmó que Sara puede registrar su lectura y Manuel no puede consultar ni marcar su lectura por ella. No se modificaron tareas reales para esa prueba.

Los correos quedan para una fase posterior, por petición de Manuel. No se configuró proveedor ni se enviaron emails. Sin despliegue Netlify.
