# Clientes completados desde facturas — 14/09/2026

Se actualizaron 22 fichas existentes en Supabase: 21 clientes destinatarios de las 30 facturas PDF originales y Silvia García Pintos, cuyo nombre fiscal figura en Seguimiento Facturas del Excel y cuya identidad con Silvia Fuego confirmó Manuel. Se cambiaron 15 nombres visibles y se conservaron alias comerciales relevantes. No se crearon clientes nuevos.

Se completaron campos vacíos de dirección, código postal, ciudad, provincia y país cuando el destinatario permitía identificarlos. La razón social se separó del departamento o nombre comercial cuando correspondía. Se conservaron contactos, direcciones y ciudades existentes, así como los datos originales adicionales. El marcador «Column 8» de Christelle se sustituyó por la transcripción del destinatario real. Cada ficha incluye las facturas utilizadas y las discrepancias en sus notas de facturación.

No se copiaron los datos del emisor Manuel Forner Rubert ni su cuenta bancaria a los clientes. Tampoco se inventaron correos, teléfonos, condiciones de pago o datos fiscales ausentes.

## Pendientes de confirmar

- O Beach / ICE MOUNTAIN: el original imprime `B57704124n`; el CIF estructurado sigue vacío.
- RITUAL COLLECTIVE: el original imprime `B972791098`; el CIF estructurado sigue vacío.
- CLOCKWORK ORANGE: el original imprime `RM14 25J`; se conserva en la dirección, pero no se completa el campo postal dudoso. `9370898` se identifica como número de empresa extranjero impreso, sin considerarlo CIF español.
- Lorena Gallego Vicente / Namkha: se comprobó visualmente la dirección de la factura 021. Se transcribe literalmente `C/ Oblit Nº 7 a 7 ático, 08041 Barcelona`; la indicación «7 a 7» requiere confirmar antes de emitir otra factura.
- Christelle: el original imprime BAROUSE y la ficha existente dice Barousse. Se mantiene el nombre previo y se registra la discrepancia.
- Ayuntamiento / Ajuntament d’Eivissa: se conserva la dirección fiscal original adicional CL FORNAS, 43 y la dirección de facturación C/ Canarias 35 de la factura 001; la diferencia queda anotada.
- Silvia García Pintos: nombre fiscal confirmado desde Excel; no hay PDF original disponible para añadir CIF o dirección.

## Verificación y respaldo

Los SHA-256 de los 30 PDFs revisados coinciden con los documentos originales registrados. La actualización se realizó sobre los mismos identificadores de cliente, con comprobación de concurrencia y respaldo previo de las tablas de la organización.

- Clientes: 492 antes y después.
- Fichas actualizadas: 22; nombres visibles cambiados: 15.
- Los 71 eventos vinculados a estas fichas conservan sus relaciones.
- Todas las tablas de negocio ajenas a clientes permanecen iguales: facturas, pagos, eventos, artistas, shows, proveedores y demás relaciones.
- Facturado: 148.408,45 €; cobrado: 107.931,17 €; pendiente: 40.477,28 €. Sin cambios.
- Comprobación autenticada de `/api/client-board` tanto local como en `https://performancelabso.netlify.app`: 200, 492 clientes y coincidencia exacta de los campos actualizados de las 22 fichas.

Respaldo privado: `/Users/manuel/Documents/Codex/2026-09-09/vam/backups/client-enrichment-2026-09-14T13-24-13-634Z`. Plan detallado y verificación de esta ejecución: `/tmp/plab-client-enrichment/`.

No se realizó despliegue en Netlify. La versión publicada recibe los datos actualizados de Supabase.
