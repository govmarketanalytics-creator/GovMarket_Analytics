-- GOVMARKET ANALYTICS / FASE 2 / CONSULTA DE ESTRUCTURA
-- SOLO LECTURA. No consulta registros personales, no modifica esquema.
-- Ejecutar en pgAdmin Query Tool sobre una base de prueba autorizada.

-- 1. Tablas del esquema public
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Columnas, tipos y nulabilidad
SELECT table_name, ordinal_position, column_name, data_type,
       udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 3. Claves primarias y foráneas efectivas
SELECT tc.table_name, tc.constraint_name, tc.constraint_type,
       kcu.column_name, ccu.table_name AS tabla_referenciada,
       ccu.column_name AS columna_referenciada
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.constraint_schema = kcu.constraint_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
 AND tc.constraint_schema = ccu.constraint_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type IN ('PRIMARY KEY','FOREIGN KEY')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position;

-- 4. Migraciones aplicadas (si la tabla existe en el esquema)
-- SELECT id, timestamp, name FROM public.migrations ORDER BY timestamp;
