# Fichas de Pagos

Continuación local del 14 de septiembre de 2026. Sin despliegue en Netlify ni cambios en los datos de Supabase.

- Pagos reúne artistas con actividad y todos los proveedores fiscales, reutilizando las mismas entidades y fichas bancarias de Facturación.
- Búsqueda por nombre, ciudad y habilidades del artista; proveedores por nombre y alias. Ignora tildes y mayúsculas. Filtros por saldo pendiente, importes desconocidos o banco por revisar.
- Directorio y fichas calculan gastos, pagos asignados, saldo y banco sin asignar por moneda. Las transferencias no se añaden de nuevo al coste. Los pagos a proveedores no se identifican como salarios netos.
- Los pagos históricos vinculados a gastos se incluyen también en la lectura bancaria, como en Gastos recibidos, sin crear filas ni transferencias nuevas.
- Las asignaciones sin gasto se muestran aparte, con el control existente para guardar importe y estado de pago. Los gastos vinculados se editan desde su ficha financiera, evitando repetir el mismo trabajo en ambas tablas.
- Actualización al volver a la ventana y cada 15 segundos mientras esté visible. La ficha de artista reutiliza la lectura actualizada del directorio.

Validación: 51 pruebas, comprobación de tipos y compilación de producción. Inspección en navegador del directorio, búsqueda «africa», ficha de África Bataller y ficha de FEDRIANI EVENT SL. La nueva prueba financiera comprueba monedas separadas, gasto sin total, gasto cancelado, pagos históricos y transferencias parcialmente asignadas.

Los importes aún desconocidos y las conciliaciones pendientes siguen señalados. El dashboard de eventos y su dinero en efectivo siguen siendo independientes del registro de facturación.
