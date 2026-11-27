import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { consultaAnalisis } from "./consulta-analisis";
import type { ConsultarAnalisisMercadoDto } from "./dto/consultar-analisis-mercado.dto";
import type { ConsultarLicitacionesAnalisisDto } from "./dto/consultar-analisis-mercado.dto";
import {
  identificarRegion,
  porcentaje,
  REGIONES_ANALISIS,
  sumarMontos,
  totalesVacios,
  variacion,
} from "./modelo-analisis";
import type { DatosAnalisisRaw } from "./modelo-analisis";

@Injectable()
export class AnalisisMercadoService {
  constructor(private readonly dataSource: DataSource) {}

  async listarLicitaciones(
    empresaId: string,
    filtros: ConsultarLicitacionesAnalisisDto,
  ) {
    const { sql, parametros } = consultaAnalisis(empresaId, filtros);
    let cte = sql.slice(0, sql.indexOf("\nSELECT jsonb_build_object("));
    if (filtros.rutProveedor) {
      parametros.push(
        filtros.rutProveedor.replace(/[.\s-]/g, "").toUpperCase(),
      );
      cte +=
        ", seleccion AS (SELECT * FROM datos d WHERE actual AND monto IS NOT NULL AND EXISTS (" +
        "SELECT 1 FROM licitacion_adjudicaciones a WHERE a.resultado_id = d.resultado_id " +
        "AND regexp_replace(upper(btrim(a.rut_proveedor)), '[.[:space:]-]', '', 'g') = $" +
        parametros.length +
        "))";
    } else cte += ", seleccion AS (SELECT * FROM datos WHERE actual)";
    parametros.push(filtros.limite, (filtros.pagina - 1) * filtros.limite);
    const consulta =
      cte +
      "\nSELECT jsonb_build_object('total', (SELECT count(*)::int FROM seleccion), " +
      "'datos', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM (" +
      'SELECT codigo_externo AS codigo, nombre, estado, fecha_publicacion AS "fechaPublicacion", fecha_cierre AS "fechaCierre" ' +
      "FROM seleccion ORDER BY fecha_publicacion DESC, codigo_externo " +
      "LIMIT $" +
      (parametros.length - 1) +
      "::int OFFSET $" +
      parametros.length +
      "::int) p), '[]'::jsonb)) AS datos";
    const [fila] = await this.dataSource.query<
      Array<{
        datos: {
          total: number;
          datos: Array<{
            codigo: string;
            nombre: string;
            estado: string;
            fechaPublicacion: string;
            fechaCierre: string | null;
          }>;
        };
      }>
    >(consulta, parametros);
    return { ...fila.datos, pagina: filtros.pagina, limite: filtros.limite };
  }

  async consultar(empresaId: string, filtros: ConsultarAnalisisMercadoDto) {
    const { sql, parametros, anterior } = consultaAnalisis(empresaId, filtros);
    // Una sola sentencia: todos los cuadros comparten instantánea, filtros y cohorte.
    const [fila] = await this.dataSource.query<
      Array<{ datos: DatosAnalisisRaw }>
    >(sql, parametros);
    const raw = fila.datos;
    const actual = { ...totalesVacios, ...raw.totales.find((t) => t.actual) };
    const previo = { ...totalesVacios, ...raw.totales.find((t) => !t.actual) };
    let sinRegion = 0;
    const regiones = REGIONES_ANALISIS.map(({ codigo, nombre }) => ({
      codigo,
      nombre,
      cantidad: 0,
      monto: null as string | null,
      porcentaje: null as number | null,
      nivel: "sin_datos" as "alta" | "baja" | "sin_datos",
    }));
    for (const filaRegion of raw.regiones) {
      const region = identificarRegion(filaRegion.nombre);
      const destino = regiones.find((r) => r.codigo === region?.codigo);
      if (!destino) {
        sinRegion += filaRegion.cantidad;
        continue;
      }
      destino.cantidad += filaRegion.cantidad;
      destino.monto = sumarMontos(destino.monto, filaRegion.monto);
    }
    for (const region of regiones) {
      region.nivel =
        region.cantidad === 0
          ? "sin_datos"
          : region.cantidad <= 10
            ? "baja"
            : "alta";
      region.porcentaje = porcentaje(region.cantidad, actual.publicadas);
    }
    const evolucion = Array.from(
      { length: Math.ceil(anterior.dias / anterior.diasPorTramo) },
      (_, tramo) => {
        const hoy = raw.evolucion.find((e) => e.actual && e.tramo === tramo);
        const antes = raw.evolucion.find((e) => !e.actual && e.tramo === tramo);
        const inicio =
          Date.parse(filtros.fechaDesde + "T00:00:00Z") +
          tramo * anterior.diasPorTramo * 86_400_000;
        return {
          periodo: new Date(inicio).toISOString().slice(0, 10),
          cantidad: hoy?.cantidad ?? 0,
          anteriorCantidad: antes?.cantidad ?? 0,
          monto: hoy?.monto ?? null,
          anteriorMonto: antes?.monto ?? null,
          conMonto: hoy?.conMonto ?? 0,
        };
      },
    );
    return {
      versionContrato: 2,
      generadoEn: new Date().toISOString(),
      fuente: "Dirección ChileCompra · información almacenada en GovMarket",
      zonaHoraria: "America/Santiago",
      filtrosAplicados: filtros,
      periodoAnterior: anterior,
      perfil: raw.perfil,
      metricas: {
        ...actual,
        proveedoresAdjudicados: raw.proveedoresBase.cantidad,
        tasaDesiertas: porcentaje(
          actual.desiertas,
          actual.adjudicadas + actual.desiertas,
        ),
        porcentajeBajaParticipacion: porcentaje(
          actual.bajaParticipacion,
          actual.conOferentes,
        ),
      },
      comparacion: {
        publicadas: {
          anterior: previo.publicadas,
          variacion: variacion(actual.publicadas, previo.publicadas),
        },
        monto: {
          anterior: previo.montoAdjudicado,
          conMonto: previo.conMonto,
          variacion: variacion(actual.montoAdjudicado, previo.montoAdjudicado),
        },
      },
      cobertura: {
        licitaciones: actual.publicadas,
        conDetalle: actual.conDetalle,
        conResultado: actual.conResultado,
        porcentajeResultados: porcentaje(
          actual.conResultado,
          actual.publicadas,
        ),
        conOferentes: actual.conOferentes,
        conMonto: actual.conMonto,
        sinRegion,
        ultimaSincronizacion: actual.ultimaSincronizacion,
        primeraPublicacion: actual.primeraPublicacion,
        ultimaPublicacion: actual.ultimaPublicacion,
      },
      evolucion,
      organismos: raw.organismos,
      categorias: raw.categorias,
      regiones: { datos: regiones, sinRegion },
      proveedores: raw.proveedores,
      proveedoresBase: raw.proveedoresBase,
      resultados: raw.resultados,
      distribucionTipos: raw.tipos,
      opciones: {
        ...raw.opciones,
        regiones: regiones
          .filter((r) => r.cantidad > 0)
          .map(({ codigo, nombre }) => ({ codigo, nombre })),
      },
      metodologia: [
        "La selección y todos los rankings usan la fecha de publicación en hora de Chile. Los montos son adjudicaciones asociadas a esa cohorte, no gasto efectuado durante el período.",
        "La comparación utiliza el período inmediatamente anterior de igual duración. Las cohortes recientes pueden tener más procesos pendientes.",
        "Los conteos incluyen todas las monedas; los importes y proveedores usan solo la moneda seleccionada. No se convierten monedas ni se sustituyen importes ausentes por cero.",
        "Los montos requieren adjudicación y todos sus importes informados. La participación se calcula sobre el monto con proveedor y RUT identificados.",
        "Los oferentes se toman de campos generales del proceso; se excluyen máximos derivados por ítem. La mediana y baja participación usan solo procesos cerrados con número informado.",
        "La tasa de desiertas usa desiertas / (adjudicadas + desiertas). Pendientes, revocadas y cerradas sin resultado no entran en ese denominador.",
        "Mi sector cruza categorías y términos literales del perfil activo. Es un filtro comercial, no un porcentaje de cumplimiento ni una probabilidad de adjudicación.",
        "La región corresponde al organismo comprador; no acredita lugar de entrega. El mapa es esquemático.",
        "La cobertura describe los registros guardados, no garantiza que esté descargado todo Mercado Público. Los registros marcados esPrueba se excluyen.",
      ],
    };
  }
}
