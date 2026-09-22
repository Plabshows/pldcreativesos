# Sales Kit — primera fase

El registro maestro sigue siendo `shows`. `show_kit_sections` amplía cada show con documentos separados por finalidad. No se duplica catálogo ni se modifican datos económicos existentes.

## Uso

Shows → Abrir ficha → Resumen, Comercial, Media, Ficha técnica cliente, Brief del artista, Kit de almacén, Mantenimiento. Cada pestaña se guarda de forma independiente; versiones evitan sobreescrituras simultáneas.

Media admite URLs externas de fotos/vídeos y las marcas HERO, BEST PHOTO, MAIN VIDEO y CLIENT APPROVED. Los enlaces para cliente solo incluyen assets marcados CLIENT APPROVED y la ficha técnica. No incluyen el documento comercial interno. El PDF usa exclusivamente la lista de campos técnicos autorizados.

Eventos → ficha → Material comercial y preparación. Se reutiliza `event_shows.quantity` para multiplicar las piezas del kit. Se conservan líneas separadas por show para no mezclar tallas, ubicaciones o componentes parecidos. La checklist se guarda por evento y detecta conflictos de versión; cambiar la cantidad invalida la marca anterior. No constituye una reserva de stock.

Seleccionar un artista del evento y generar su brief crea una instantánea del show elegido con nombre, fecha, venue y ciudad del evento y nombre del artista. La API verifica ambas relaciones. No publica teléfonos, clientes, tarifas ni pagos. El usuario decide qué show corresponde a cada artista; la relación actual event_talent no identifica automáticamente su personaje.

## Acceso

- admin / producer (operaciones): todas las secciones.
- sales: comercial, media y ficha técnica.
- wardrobe (almacén): kit y mantenimiento.
- artista/cliente externo: solo instantánea explícitamente compartida mediante token aleatorio, con caducidad de siete días. No necesitan una cuenta del CRM.

RLS protege las filas, no solo la interfaz. Las tablas nuevas no conceden acceso anónimo. La única función anónima devuelve una instantánea por token válido y no revocado. Los enlaces son credenciales por posesión: cualquier receptor del enlace puede ver esa instantánea hasta su caducidad. No enviamos mensajes automáticamente.

Los enlaces emitidos se recuperan desde el historial de la ficha, incluidos los caducados y revocados. Las propuestas nuevas usan el nombre y descripción comerciales guardados; los presupuestos existentes conservan sus textos.

## QR

Las fichas conservan identificadores estables y las piezas tienen referencia a concepto, caja y asset interno. La ruta interna `/?show=<UUID>#shows` abre la ficha con permisos del usuario; se puede codificar posteriormente en QR. No utilizar tokens temporales como etiquetas permanentes de almacén. No se han generado QR ni contenidos ficticios.

## Limitaciones de esta fase

- Los URLs de medios deben ser accesibles al receptor; la descarga depende de las condiciones/CORS del proveedor externo. No hay descarga ZIP.
- PDF con imagen JPG/PNG desde una URL HTTPS pública de hasta 5 MB. Una imagen inaccesible produce un aviso y no se omite silenciosamente.
- El QR por caja y el seguimiento histórico detallado de mantenimiento siguen utilizando la futura vinculación de identificadores y el módulo de inventario existente; no se duplica el registro de reparaciones.
- No se ha desplegado la aplicación. En local, los enlaces compartidos son localhost: solo serán utilizables desde fuera tras el despliegue.

Migración: 202609220004_show_kits.sql. Aplicada a Supabase y registrada. Tests: aislamiento de roles y organizaciones, inmutabilidad del show/sección, versiones, caducidad/revocación y cálculo de cantidades.
