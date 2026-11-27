-- Consultas de metadatos: no exponen contraseñas ni registros.
SELECT column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' ORDER BY ordinal_position;
SELECT tc.constraint_name, tc.constraint_type FROM information_schema.table_constraints AS tc WHERE tc.table_schema='public' AND tc.table_name='usuarios' ORDER BY tc.constraint_type;
