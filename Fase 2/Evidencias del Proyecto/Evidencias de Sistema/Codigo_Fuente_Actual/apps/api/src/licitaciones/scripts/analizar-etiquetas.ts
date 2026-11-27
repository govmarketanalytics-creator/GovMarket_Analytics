import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import AppDataSource from '../../database/data-source';
import {
  analizarEtiquetas,
  type RegistroAnalisisEtiquetas,
} from '../analizador-etiquetas';

async function ejecutar(): Promise<void> {
  const rutaSalida = resolve(
    process.argv[2] ?? 'analisis-etiquetas-mercado-publico.json',
  );

  try {
    await AppDataSource.initialize();

    const consulta = await AppDataSource.query(`
      SELECT
        l.codigo_externo AS "codigoExterno",
        l.nombre,
        l.descripcion,
        l.tipo,
        COALESCE(
          array_remove(array_agg(DISTINCT i.categoria), NULL),
          ARRAY[]::varchar[]
        ) AS categorias,
        COALESCE(
          array_remove(array_agg(DISTINCT i.nombre_producto), NULL),
          ARRAY[]::varchar[]
        ) AS "nombresItems",
        COALESCE(
          array_remove(array_agg(DISTINCT i.descripcion), NULL),
          ARRAY[]::text[]
        ) AS "descripcionesItems"
      FROM licitaciones l
      LEFT JOIN licitacion_items i ON i.licitacion_id = l.id
      WHERE l.activa_en_listado = true
        AND l.codigo_estado = 5
        AND l.fecha_cierre >= now()
      GROUP BY l.id
      ORDER BY l.codigo_externo
    `);
    const registros = consulta as unknown as RegistroAnalisisEtiquetas[];
    const resultado = analizarEtiquetas(registros);

    await writeFile(rutaSalida, JSON.stringify(resultado, null, 2), 'utf8');

    console.log('ANALISIS DE ETIQUETAS: OK');
    console.log(
      `LICITACIONES ANALIZADAS: ${resultado.resumen.licitacionesAnalizadas}`,
    );
    console.log(`CON DESCRIPCION: ${resultado.resumen.conDescripcion}`);
    console.log(`CON ITEMS: ${resultado.resumen.conItems}`);
    console.log(
      `COBERTURA DE DETALLE: ${resultado.resumen.coberturaDetallePorcentaje}%`,
    );
    console.log(`PALABRAS CANDIDATAS: ${resultado.palabrasCandidatas.length}`);
    console.log(`FRASES CANDIDATAS: ${resultado.frasesCandidatas.length}`);
    console.log(`ARCHIVO: ${rutaSalida}`);
    console.log('PRIMERAS 20 PALABRAS:');

    for (const candidato of resultado.palabrasCandidatas.slice(0, 20)) {
      console.log(
        `- ${candidato.texto}: ${candidato.licitaciones} licitaciones (${candidato.porcentaje}%)`,
      );
    }
  } catch (error: unknown) {
    const mensaje =
      error instanceof Error ? error.message : 'Error desconocido';

    console.error(`ANALISIS DE ETIQUETAS: ERROR - ${mensaje}`);
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

void ejecutar();
