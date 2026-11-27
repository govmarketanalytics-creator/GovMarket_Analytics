-- Consulta de solo lectura de migraciones registradas por TypeORM.
-- EJECUTAR SOLO EN CONEXION AUTORIZADA. NO MODIFICA DATOS.
SELECT id, "timestamp", name FROM public.migrations ORDER BY "timestamp", id;
