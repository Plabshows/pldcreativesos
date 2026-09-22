# Inventario Ibiza — 22 septiembre 2026

## Resultado verificado en Supabase
- Organización Performance Lab: 191c90ad-5337-405e-9d1a-abae2ad8c70e.
- 58 conceptos del listado: 52 creados, 6 actualizados.
- 156 registros añadidos: 146 piezas/componentes y 10 sets completos. No equivale a 156 prendas individuales.
- Total observado: 71 conceptos y 161 registros físicos. Se conservan los 4 HUMANOIDS previos y HED-01 / Hedge Man añadido simultáneamente por otro flujo.
- Comparación por ID y todos los campos originales: las 4 piezas previas intactas; los 19 conceptos anteriores conservados; datos de DUBAI intactos.
- Todos los conceptos importados: Ibiza, Performance Lab, activo, Por revisar, septiembre 2026, fuente Inventario manual Manuel. Piezas nuevas: condición UNCHECKED; sin reservas iniciales.
- No se borraron ni fusionaron fichas dudosas. No se inventaron precios, tallas, fotografías ni reparaciones.

## Fichas actualizadas
Boombox Heads (3), Mirror Women (4), Smileys (3), Teddy Monster (1), The Faces (3), TV Heads (5)

Los nombres existentes y sus IDs se han conservado (THE FACE, MIRROR WOMAN, etc.). Las variantes del documento se usan para identificar la misma ficha.

## Fichas creadas
360 Face (3 registros físicos); AC/DC (5 registros físicos); Adidas Costumes (8 registros físicos); ALF (1 registros físicos); Astro Skaters (2 registros físicos); Astronaut Helmets (2 registros físicos); Backstreet Boys (1 registros físicos); Baterías (4 registros físicos); Big Colour Poms (4 registros físicos); Black Elegant Sequin Jackets (5 registros físicos); Bunnies (2 registros físicos); Cats (2 registros físicos); Colour Sequin (2 registros físicos); Cookie (1 registros físicos); Cosmic Girls (4 registros físicos); Disco Balls (6 registros físicos); Disco Helmets (2 registros físicos); ET (1 registros físicos); Fantasma blanco (1 registros físicos); Ghostbusters (4 registros físicos); Gold Rhinestone Catsuits (3 registros físicos); Gold Sequin Jumpsuits (1 registros físicos); Golden Mirror Men new (2 registros físicos); Golden Mirror Men old (2 registros físicos); Golden Pom Pom (2 registros físicos); Golden Slinky (1 registros físicos); Gorillas (3 registros físicos); Hedge Men (2 registros físicos); Laser Gloves (1 registros físicos); LED Girls (2 registros físicos); Little Pom Neon (3 registros físicos); Michael Jackson (1 registros físicos); Mirror Ball Golden (1 registros físicos); Mirror Ballerinas Gold (2 registros físicos); Mirror Men old (4 registros físicos); Monkey Masks (4 registros físicos); Pink Poms (2 registros físicos); Robots (4 registros físicos); Sexy GoGo Mirror Costumes (2 registros físicos); Silver Poms (2 registros físicos); Silver Rhinestone (2 registros físicos); Silver Sequin (2 registros físicos); Slimer (1 registros físicos); Small Poms (7 registros físicos); Spice Girls (1 registros físicos); Star Wars (9 registros físicos); Sumo (2 registros físicos); T-Rex (2 registros físicos); Teddy Big (1 registros físicos); Teddy Skaters (2 registros físicos); Trajes Astro Humanoids (2 registros físicos); Unicorns (2 registros físicos)

## Coincidencias que requieren revisión
- Big Colour Poms ↔ POM POM MONSTERS
- Bunnies ↔ MIRROR RABBITS
- Disco Balls ↔ MIRROR BALL HEADS
- Disco Helmets ↔ MIRROR BALL HEADS
- Golden Mirror Men new ↔ MIRROR MEN
- Golden Mirror Men old ↔ MIRROR MEN
- Golden Pom Pom ↔ POM POM MONSTERS
- Golden Slinky ↔ SLINKY
- Gorillas ↔ INFLATABLE GORILLAS
- Hedge Men ↔ HEDGE / BUSH
- Little Pom Neon ↔ POM POM MONSTERS
- Mirror Ball Golden ↔ MIRROR BALL HEADS
- Mirror Men old ↔ MIRROR MEN
- Pink Poms ↔ POM POM MONSTERS
- Silver Poms ↔ POM POM MONSTERS
- Small Poms ↔ POM POM MONSTERS
- Teddy Big ↔ TEDDY BEAR
- Unicorns ↔ MIRROR UNICORNS

No se da por probado que estos artículos sean iguales. Se mantienen ambas fichas y la marca REVISAR DUPLICADO. HEDGE / BUSH ahora incluye una pieza HED-01 creada durante esta tarea: revisar su relación con las dos Hedge Men importadas.

## Confirmaciones
- Star Wars: Manuel confirmó que el set está formado por Darth Vader ×1, Stormtroopers ×4, Yoda ×1, Obi-Wan Kenobi ×1 y Lightsabers ×2. Una ficha con 9 componentes; no se crea una décima pieza por el set.
- HUMANOIDS ×4 son adicionales a Trajes Astro Humanoids ×2 y Astro Skaters ×2. Se conservan los cuatro originales.
- Teddy Big ×1: cantidad asumida en la fuente; sigue pendiente de confirmación.
- Sets de Backstreet Boys, Ghostbusters, Spice Girls, Gold Sequin Jumpsuits y Gold Rhinestone Catsuits: composición interna pendiente; una unidad de stock representa un set completo.

## Funcionamiento
- Fichas de conceptos y piezas editables. Campos de familia, subcategoría, propietario, revisión, coste de compra, fabricación, valor estimado, reposición, precio de alquiler y con performer, talla, sububicación, fechas, imagen y notas.
- Familias y categorías filtrables; Star Wars incluye piezas nominadas. Las familias agrupan fichas sin añadir existencias ficticias.
- Eventos: selector de material, cantidad y alquiler total asignado. Reserva piezas concretas de forma transaccional y rechaza falta de existencias. Estados reservado, en evento, devuelto y cancelado.
- Cancelar conserva la asignación histórica y libera las piezas. No borra el historial.
- Al marcar un evento completed/cancelled se devuelven/cancelan sus reservas. Las piezas con incidencias mantienen su estado.
- Incidencias editables: daño, pérdida, reparación, limpieza, fechas, responsable, costes, fotografías mediante enlaces y resolución.
- ROI estimado sólo con inversión e importes completos; usa costes por pieza cuando están informados y, en su defecto, el coste total declarado del concepto. No mezcla estimaciones con reparaciones reales ni confunde alquiler asignado con dinero cobrado. Clasificación por ROI disponible en catálogo.

## Límites explícitos
- La devolución automática se dispara al cambiar el estado del evento, no por reloj/calendario. No hay un job nocturno nuevo.
- La reserva bloquea la pieza hasta su devolución/cancelación; no implementa reservas futuras por intervalos.
- Las imágenes se guardan mediante enlaces; no se ha añadido una galería o carga masiva a Storage.
- Los importes de alquiler no generan cobros ni alteran Pagos/Facturación.
- Nuevas pantallas comprobadas en local. Esta tarea no ha ejecutado un deploy. Antigravity introdujo commits/aplicó la migración 202609220001 durante el trabajo; se detectó y no se reejecutó.
- Se aplicó y registró 202609220002 para impedir liberar manualmente piezas con reservas/incidencias y rechazar alquileres negativos.

## Respaldo e importación
Respaldo privado: ../../backups/inventory-20260922/ (before.json, import.sql, import-result.json, after.json). Importación transaccional e idempotente por fuente; una segunda ejecución no añade piezas ni resetea cambios posteriores. Generador: tools/prepare-ibiza-import.mjs. Manifiesto: lib/inventory-ibiza.json.

## Verificación
Prueba PGlite: importación repetida sin duplicados, composición Star Wars, reserva de unidades, exceso de cantidad rechazado sin escrituras parciales, devolución al completar, limpieza conservada y bloqueo de liberación manual. Validación visual con sesión: catálogo real, Star Wars y ficha individual de Darth Vader. No se crearon eventos ni cobros de prueba en producción.

