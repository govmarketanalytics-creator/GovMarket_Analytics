# GovMarket Analytics · Entrega técnica Fase 2 · REVISION

**Ruta académica real:** `Fase 2/Evidencias del Proyecto/`.
**Fecha de extracción del código:** 2026-11-27T22:56:37.123Z.
**Integridad:** 230/230 archivos fuente coinciden en SHA256 y tamaño con el manifiesto entregado.
**Evidencias:** 13 módulos S01-S13, 7 módulos B01-B07.

## Contenido de cada módulo

- `01_Imagen_Codigo_Actual.png`: extracto literal numerado de un archivo fuente EXPORTADO EN ESTA ENTREGA. Es una imagen renderizada desde código, no una captura del escritorio.
- `02_Explicacion_Tecnica.docx`: qué implementa, recorrido, dependencias, explicación y verificación propuesta.
- `03_Reflejo_Funcional.pdf`: mapa de funcionamiento y pasos para capturar una verificación REAL. **No acredita ejecución por sí solo**.
- `04_Codigo_Real/`: copia exacta del archivo fuente principal documentado.
- `05_Trazabilidad_y_Estado.json`: ruta y hash SHA256 de la referencia.

## Código completo incluido

En `Evidencias de Sistema/Codigo_Fuente_Actual/` están los **230 archivos** del exportador que coincidieron con su manifiesto. El repositorio local podría tener otros archivos no exportados (por ejemplo, configuraciones o scripts adicionales): antes de afirmar completitud reproducible, compararlo con el árbol Git de la versión estable. No se incluyeron binarios, node_modules ni .env.

## Importante: revisión de seguridad

No se detectaron firmas de secretos de alta confianza con las expresiones de control utilizadas en estos 230 archivos. Eso **no reemplaza** una auditoría de publicación. Se detectaron 7 cadenas con apariencia de correo electrónico que deben revisarse antes de hacer público el código (no se incluyen sus valores en este resumen).

El recolector **excluyó expresamente 3 pruebas de autenticación** por patrones potencialmente sensibles: `auth.google.spec.ts`, `auth.registro.http.spec.ts` y `auth.registro.spec.ts`. Estas pruebas no están en el paquete; no se debe restaurarlas sin inspección.

## Esquema real PostgreSQL: todavía pendiente

Se incorporaron las **20 migraciones TypeORM reales** exportadas, y una consulta SQL de solo lectura para comprobar PK/FK, columnas y tablas. No recibimos un volcado `pg_dump --schema-only` de la base vigente ni una exportación ERD actualizada; por tanto, **no se afirma que las migraciones sean idénticas a la estructura efectivamente desplegada**. La plantilla de roles SQL es un ejemplo comentado, no un script histórico extraído de PostgreSQL.

## Estado de pruebas

Se revisó código estático y hashes. **NO se ejecutaron pruebas de frontend/backend, Webpay ni la base PostgreSQL**, puesto que este ZIP es una exportación y no contiene el entorno vivo. Los 249 tests aprobados después del rollback corresponden a la ejecución histórica relatada por el equipo, no a esta revisión.

## Política de publicación recomendada

1. Revisar las 6 ubicaciones con posible correo; confirmar que son ejemplos o eliminar/redactar si son datos reales.
2. Revisar explícitamente cualquier archivo de configuración o secreto que aparezca en el repositorio original.
3. Exportar esquema de PostgreSQL con el CMD incluido y revisarlo; no subir datos de tablas.
4. Capturar pruebas reales en QA, ocultando nombre/correo/RUT/tokens.
5. Subir a una rama de GitHub y revisar Pull Request antes de fusionar a main.

El contenido no fue subido a GitHub durante la preparación de este paquete.
