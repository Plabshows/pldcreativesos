# Facturación, gastos y clientes

Disponible en local; no se ha publicado en Netlify.

- Migraciones 013–016 aplicadas a Supabase: facturas emitidas, cobros, seguimientos, gastos, pagos de gastos, categorías y datos de facturación de clientes.
- Los pagos son registros separados. El saldo determina automáticamente parcial, pagada y vencida. Las comprobaciones en base de datos impiden exceder el saldo o mezclar monedas.
- Los trabajos existentes generan gastos vinculados al artista y al evento, sin duplicar los pagos antiguos. Un fee desconocido queda vacío; el coste estimado no se convierte en gasto real.
- Pendientes separa cobros, facturas de proveedores que faltan y facturas recibidas por pagar. Los documentos se vinculan mediante URL; no se generan facturas fiscales ni se envían mensajes.
- En Clientes, ventas de eventos y facturas vinculadas no se suman dos veces. Los cobros y saldos se calculan desde facturas. Sin ingresos y gastos completos no se publica un beneficio.
- Client Score: 25% percentil económico, 20% percentil trabajos, 20% pagos, 20% importancia y 15% facilidad. Necesita ambas valoraciones y al menos tres facturas liquidadas o vencidas. Sin evidencia se muestra Sin datos.
- La vista Todos los clientes permite comparar métricas entre tableros. El orden manual conserva los grupos y el movimiento entre ellos.

Validación: pruebas de cálculo, pagos parciales, aislamiento de moneda, puntuaciones sin datos y no duplicación; comprobación de carga de las fichas en navegador. Pruebas de pagos en Supabase con rollback, sin facturas ficticias persistidas.
