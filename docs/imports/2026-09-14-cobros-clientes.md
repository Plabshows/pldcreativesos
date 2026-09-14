# Cobros de clientes desde el Excel de Ibiza

Fuente: `IBIZA_2026_PRO (5).xlsx`, pestaña `Seguimiento Facturas`, filas 3–54. La pestaña de pagos del otro Excel contiene salidas de dinero y no se utiliza como cobros. Fecha de importación: 14 de septiembre de 2026.

## Resultado

Se reutilizan las 30 facturas originales del CRM y se incorporan 21 registros históricos de factura ausentes, sin generar documentos PDF ficticios. Se registran 35 cobros en el mismo `invoice_payments` que usa el dashboard, por un total de **107.931,17 EUR**.

El módulo queda con 51 facturas, **148.408,45 EUR facturados**, **107.931,17 EUR cobrados** y **40.477,28 EUR pendientes**. Son saldos según el Excel, no una conciliación con el banco ni una confirmación de que no haya cobros posteriores. La factura PDF 028 de 825 EUR permanece pendiente; la numeración del Excel está por revisar.

Las fechas de cobro se interpretan como liquidación de la factura identificada. Las notas con varios plazos se conservan y desglosan:

| Factura | Cobros registrados | Pendiente |
|---|---|---|
| 002 | 800 EUR el 11/05; 790 EUR el 25/05 | 0 EUR |
| 024 | 7.000 EUR el 11/08; 7.119,20 EUR el 14/08 | 0 EUR |
| 039 | 3.000 EUR el 26/08; 3.360 EUR el 09/09 | 0 EUR |
| 043 | 8.143,64 EUR el 03/09 | 8.143,63 EUR |

La 018 es una factura de anticipo de 1.086,50 EUR; se registra su cobro completo, sin dividir de nuevo ese importe por dos. La 034 factura el primer 50% del contrato de aeropuertos; cobrar esta factura no implica cobrar el contrato completo. La 043 recoge su segunda factura parcialmente cobrada.

## Relaciones y conservación

- Se cruzan número, importe, fecha y contexto del seguimiento con las facturas PDF existentes. Las diferencias entre nombres comerciales/fiscales del Excel y el PDF no cambian el cliente original de una factura.
- Silvia García Pintos se relaciona con el cliente existente Silvia Fuego, confirmado expresamente por Manuel. No se crea otro cliente para ella.
- Se incorporan tres clientes fiscales escritos en el Excel: FUNDACION PACHA, FANATIKO FESH SL y NOBULO CULTURE SL. No se inventan CIF, direcciones ni contactos.
- Se completa únicamente la fecha de emisión antes desconocida de la 024 con el dato explícito del Excel. No se cambian los importes ni los documentos originales.
- Los importes se redondean a céntimos; las cifras originales con más decimales se conservan en la evidencia.
- Los vencimientos desconocidos permanecen vacíos. No se inventan fechas de vencimiento ni se clasifican automáticamente como vencidas.
- Cada cobro conserva fecha, referencia, método, notas, identificador único y enlace a la fila de origen. La evidencia no es otra base de datos de ingresos: los únicos cobros que suman son los del registro existente `invoice_payments`.

## Tres registros por revisar

1. Fila 30, referencia Excel 028: 9.920 EUR, cobro declarado 07/08. El PDF 028 guardado corresponde a 825 EUR. No se sobrescribe ni se aplica el cobro de 9.920 EUR a esa factura.
2. Fila 32, referencia Excel 030: 825 EUR, mismo cliente y fecha que el PDF 028. No se crea otra factura potencialmente duplicada ni se renumera el original.
3. Fila 73: depósito Charley Dobson, importe de factura 318 EUR, sin número/cliente y fecha de cobro inválida (-18). No se convierte el total de factura en cobro confirmado ni se enlaza con un cliente/evento por suposición.

El importe adicional de 9.920 EUR declarado en la fila discrepante queda fuera de los cobros identificados hasta su revisión. Los dos registros de Clockwork podrían corresponder a documentos distintos o a un error de numeración; no se resuelve esa duda automáticamente.

## Dashboard y comprobaciones

El dashboard local permite total general o períodos mensuales. Las facturas se filtran por emisión y muestran su saldo actual. Un indicador separado muestra los cobros por fecha de pago. Las incidencias del Excel son visibles y cada ficha muestra su origen e historial de cobros. El dashboard de eventos y el efectivo permanecen independientes.

Validación: 54 pruebas, comprobación de tipos y compilación de producción. Repetir el cruce del mismo archivo propone **0 clientes, 0 facturas, 0 evidencias y 0 cobros nuevos**. Se comprueban importes de la 043 en navegador y los mismos totales mediante la API local y la API de producción.

Copia previa: `/Users/manuel/Documents/Codex/2026-09-09/vam/backups/collections-import-2026-09-14T13-14-25-198Z`, con tablas públicas, esquema y Excel original. Se verifica que eventos, talento, proveedores/pagos bancarios, gastos, documentos y relaciones previas no cambian; los clientes anteriores también se conservan.

Los datos están en Supabase y se leen en la versión online existente. No se ha desplegado una nueva versión en Netlify: el selector mensual y las nuevas evidencias visuales están por ahora en local.
