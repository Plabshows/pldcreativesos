# Importación de pagos bancarios de 2026

Fuente: `Pagos_trabajadores_proveedores_2026_reconciliados.xlsx`, hoja **Todos los pagos**, filas 2–81. Las otras cinco hojas se revisaron como filtros y resúmenes; no se importaron de nuevo.

## Resultado

| Resultado | Registros | Importe |
| --- | ---: | ---: |
| Movimientos importados | 80 | 85.858,50 € |
| Conciliados, con gasto y evento confirmados | 6 | 4.412,45 € |
| Necesitan revisión | 35 | 29.790,26 € |
| Sin conciliar | 39 | 51.655,79 € |
| Pagos asignados a gastos | 25 | 28.355,70 € |
| Banco todavía por asignar a gastos | — | 57.502,80 € |

Un pago puede estar asignado a un gasto identificado y seguir en revisión porque falta confirmar el evento. Por eso los 25 pagos asignados y los 6 movimientos totalmente conciliados son medidas distintas.

Se crearon **31 gastos**. Dos movimientos adicionales reutilizan las mismas referencias de gasto, sin crear facturas duplicadas. Los documentos de las facturas recibidas siguen pendientes: el Excel identifica referencias e importes, pero no sustituye sus PDF.

Se reconocieron **8 artistas existentes**: África Bataller, Rocío Marianela Moyano, Cristian Solaz Gilabert, eva, zaniah, Krys, Foves y Said. No se crearon artistas nuevos. IAN queda por identificar.

Se vincularon **6 movimientos a 5 eventos**, con coincidencia de fecha y nombre de cliente/venue o espectáculo. África y Rocío se añadieron a los artistas vinculados a Coco Beach del 23/05/2026; ya figuraban en sus notas y el Excel confirma los trabajos. Los importes netos de sus sueldos no se deducen del total de una transferencia o factura.

## Proveedores

| Proveedor confirmado | Movimientos | Pagado en banco | Gastos |
| --- | ---: | ---: | ---: |
| FEDRIANI EVENT SL | 22 | 24.315,10 € | 20 |
| EVENTS BRANCH S.L. | 9 | 4.162,40 € | 9 |
| JAIROMKT 2025 SL | 1 | 2.642,89 € | 1 |
| Zaniah Costo Portillo | 1 | 318,00 € | 0 |
| CRISTINA RECIO MEDINA | 1 | 114,00 € | 1 |

Los **17 movimientos de otros autónomos/proveedores/artistas directos** del Excel suman **8.097,31 €**, incluyendo los conceptos directos cuya identidad aún requiere confirmación. Sonia, Akuarela, PRL y «Mi jael jackson» conservan el texto original; no se ha inventado una entidad fiscal a partir de esos conceptos.

Fedriani tiene una única ficha de proveedor con sus variantes como alias, enlazada a la empresa que ya existía en Clientes. Se reutilizó su CIF existente, **B19809383**, sin sobrescribir datos fiscales. Su dirección sigue disponible en la ficha fiscal vinculada.

## Incidencias pendientes

**Tres parejas de posibles pagos duplicados; seis movimientos conservados:**

- `2026-0175`: 242,00 €, 26/01 y 06/07.
- `2026-0177`: 242,00 €, 02/02 y 06/07.
- `2026-2149`: dos movimientos de 895,15 € del 03/08.

Ninguno se borró ni se asignó automáticamente a un gasto. Las parejas siguen visibles para revisar ambos pagos.

**Dos diferencias:**

- `26jm1657`: hoja Pagos 2.184,21 €; banco 2.642,89 €; diferencia **458,68 €**.
- `2026-2036`: hoja Pagos 2.014,08 €; banco 2.014,09 €; diferencia **0,01 €**.

En estas dos diferencias, se aplica el pago hasta el importe identificado en la hoja Pagos. Los excesos de 458,68 € y 0,01 € permanecen sin asignar y en revisión, con su motivo por confirmar. No se registran como un segundo gasto.

Los decimales originales de la hoja permanecen en los datos de origen. No se ha supuesto que una diferencia sea IVA, redondeo, comisión o retención.

También quedan por completar el reparto de las tres facturas de Zaniah, los totales de los anticipos de Cristian, los eventos de conceptos sin fecha o ambiguos, el reparto de facturas con varios eventos/artistas y los movimientos sin titular identificado. El Bizum de Said de 25 € se enlaza a su ficha, con el trabajo y gasto por asignar.

## Cómo utilizarlo

En **Facturación & Gastos → Pagos bancarios** aparecen los 80 movimientos. **Revisión bancaria** muestra los que quedan abiertos. Puedes buscar por concepto, factura o persona, y filtrar por fecha, proveedor, artista, cliente, evento, show y asignación del pago.

Pulsa **Abrir / conciliar** para confirmar proveedor, artista y evento. Anota el motivo de una diferencia o duplicado y guarda la revisión. Después asigna el importe al gasto correspondiente. Si una transferencia paga varias facturas, asigna una parte a cada una; la suma no puede superar el movimiento bancario. Cada gasto admite varios pagos parciales, con control de su saldo.

Si no existe el gasto o falta su importe, abre **Gastos / Facturas recibidas**, crea o completa su ficha y vuelve al movimiento. Fechas de factura, base, IVA e IRPF permanecen vacíos hasta disponer de información fiable.

Las fichas de proveedor muestran sus gastos, pagos, eventos, artistas e incidencias. En **Pagos → Abrir ficha** de un artista aparece **Trabajos y pagos**, con sus gastos vinculados, fechas, cliente, show, importes, saldo y pagos bancarios por asignar. Desde los gastos se puede abrir el movimiento de origen y la ficha fiscal del proveedor.

## Evolución del sistema existente

Se reutilizan `expenses` y `expense_payments` para los gastos y sus pagos. Los movimientos bancarios conservan la evidencia original y se enlazan a esos pagos; no se suman como una segunda contabilidad. Las nuevas fichas de proveedor son necesarias porque antes solo existía su nombre libre en el gasto.

Se añadieron al gasto proveedor enlazado, fecha de factura, fecha de trabajo, retención y clave de importación. Se conservan número, concepto, artista, evento, importe, moneda, documento, estado y seguimiento existentes. El historial y los controles de organización/permisos permanecen activos.

Cada movimiento conserva identificador, fuente, hash, hoja, fila, fecha de importación, fecha de pago, concepto y referencia originales, datos originales, importe esperado, relaciones confirmadas, sugerencias, incidencias y explicación de la revisión. La información bancaria original no se puede modificar.

El **dashboard de eventos y sus importes manuales/cash** se mantiene independiente del **dashboard de Facturación**. Los costes financieros relacionados aparecen en las fichas de eventos sin sobrescribir sus ingresos ni gastos manuales.

Hay una importación recurrente de CSV de gastos en EUR, con plantilla descargable, validación de fechas/importes y control de registros repetidos. No realiza reconocimiento OCR: la lectura automática recurrente de nuevos PDF queda para una integración posterior.

## Backup y comprobaciones

Backup previo en:
`/Users/manuel/Documents/Codex/2026-09-09/vam/backups/bank-import-2026-09-14T12-33-52-207Z`

Incluye datos de todas las tablas públicas, información de esquema y funciones, y una copia del Excel original. Las migraciones del proyecto conservan la definición de las tablas y sus relaciones.

- El número de movimientos y su total coinciden con el Excel.
- Repetir la importación original añade cero movimientos, gastos y pagos.
- Importar un CSV con los mismos 80 movimientos omite los 80 y añade cero.
- Las pruebas comprueban pagos parciales, repartos entre varias facturas, límites de saldo, originales inmutables, revisión de duplicados y asignaciones de artistas sin gastos duplicados.
- Pasan las 50 pruebas del proyecto, la compilación de producción y la comprobación de tipos. Se comprobó también que intentar añadir «Fedriani» lleva a la ficha existente y no crea otro proveedor.
- Las interfaces de pagos, gastos y artistas responden correctamente con datos de Supabase.
- Se compararon los datos anteriores y posteriores: eventos, artistas, clientes, pagos históricos, facturas emitidas, cobros y documentos originales se conservaron.
- No se ha desplegado esta actualización en Netlify.
