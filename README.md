# Performance Lab OS

Primera entrega del sistema operativo interno de Performance Lab. La interfaz de la fase 1 ya está disponible en `/`: panel diario, eventos próximos, salud de producción, tareas, pipeline y acciones rápidas.

## Arranque local

```bash
npm install
npm run dev
```

Abre `http://127.0.0.1:3000`. `/setup` explica la conexión del proyecto de Supabase.

## Datos reales

Copia `.env.example` como `.env.local` y añade la URL y la publishable key del proyecto de Supabase. Ejecuta la migración `supabase/migrations/202609090001_initial.sql` desde el editor SQL o la CLI de Supabase. Las claves secretas no se incluyen en el navegador ni en Git.

La pantalla actual usa datos de demostración para que el flujo se pueda revisar antes de conectar credenciales. El modelo, RLS, roles, cálculos y estructura de propuestas ya están definidos para persistencia real.

## Verificación

```bash
npm run typecheck
npm test
npm run build
```

## Próximo bloque

Conectar autenticación, repositorios de clientes/eventos/talento/tareas, formularios con validación y generación de propuestas PDF. Después: conceptos, vestuario, proveedores, pagos y LAB AGENT.
