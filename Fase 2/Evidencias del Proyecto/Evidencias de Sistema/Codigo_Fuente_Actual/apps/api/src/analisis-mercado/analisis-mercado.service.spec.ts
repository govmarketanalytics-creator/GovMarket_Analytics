import { describe, expect, it, vi } from "vitest";
import type { DataSource } from "typeorm";
import { AnalisisMercadoService } from "./analisis-mercado.service";
import { consultaAnalisis, periodoComparacion } from "./consulta-analisis";
import {
  consultarAnalisisMercadoSchema as schema,
  consultarLicitacionesAnalisisSchema,
} from "./dto/consultar-analisis-mercado.dto";
import {
  centavos,
  sumarMontos,
  totalesVacios,
  variacion,
} from "./modelo-analisis";

const empresa = "10000000-0000-4000-8000-000000000001";
const filtros = schema.parse({
  fechaDesde: "2026-10-01",
  fechaHasta: "2026-10-20",
});
const datos = () => ({
  totales: [
    {
      ...totalesVacios,
      actual: true,
      publicadas: 20,
      adjudicadas: 8,
      desiertas: 2,
      conResultado: 12,
      conOferentes: 4,
      medianaOferentes: 2.5,
      bajaParticipacion: 2,
      conMonto: 2,
      montoAdjudicado: "15000000.00",
    },
    {
      ...totalesVacios,
      actual: false,
      publicadas: 10,
      conMonto: 1,
      montoAdjudicado: "10000000.00",
    },
  ],
  evolucion: [
    { actual: true, tramo: 0, cantidad: 20, monto: "15000000.00", conMonto: 2 },
  ],
  organismos: [],
  regiones: [
    {
      nombre: "Región Metropolitana de Santiago",
      cantidad: 12,
      monto: "10000000.00",
    },
    { nombre: "Región de Aysén", cantidad: 2, monto: null },
    { nombre: "No informada", cantidad: 6, monto: "5000000.00" },
  ],
  categorias: [],
  proveedores: [],
  proveedoresBase: { cantidad: 0, monto: null },
  resultados: [],
  tipos: [],
  perfil: { configurado: false, categorias: 0, terminos: 0 },
  opciones: { regiones: [], categorias: [], organismos: [] },
});

describe("Análisis de mercado: criterios y cobertura", () => {
  it.each(["2026-02-30", "2026-13-01", "2026-00-10", "no-es-fecha"])(
    "rechaza una fecha inexistente: %s",
    (fechaDesde) => {
      expect(() =>
        schema.parse({ fechaDesde, fechaHasta: "2026-10-01" }),
      ).toThrow();
    },
  );
  it("rechaza orden invertido y períodos excesivos", () => {
    expect(() =>
      schema.parse({ fechaDesde: "2026-10-20", fechaHasta: "2026-10-01" }),
    ).toThrow("La fecha final no puede ser anterior");
    expect(() =>
      schema.parse({ fechaDesde: "2020-01-01", fechaHasta: "2026-10-01" }),
    ).toThrow("24 meses");
  });
  it("acepta día bisiesto y limita la paginación", () => {
    expect(
      schema.parse({ fechaDesde: "2024-02-29", fechaHasta: "2024-02-29" })
        .fechaDesde,
    ).toBe("2024-02-29");
    expect(() =>
      consultarLicitacionesAnalisisSchema.parse({ ...filtros, limite: 100000 }),
    ).toThrow();
  });
  it("calcula un período anterior de igual duración, incluso al cambiar de año", () => {
    expect(periodoComparacion("2026-01-01", "2026-01-02")).toMatchObject({
      fechaDesde: "2025-12-30",
      fechaHasta: "2025-12-31",
      dias: 2,
    });
  });
  it("no presenta crecimiento infinito ni importes ausentes como cero", () => {
    expect(variacion(20, 0)).toBeNull();
    expect(variacion(null, "10")).toBeNull();
    expect(variacion(20, 10)).toBe(100);
    expect(variacion(0, 10)).toBe(-100);
    expect(variacion(7, 6)).toBe(16.7);
    expect(variacion(5, 6)).toBe(-16.7);
    expect(sumarMontos(null, null)).toBeNull();
    expect(sumarMontos("0.00", null)).toBe("0.00");
    expect(sumarMontos("9007199254740993.01", "0.02")).toBe(
      "9007199254740993.03",
    );
    expect(centavos("9007199254740993.03")).toBe(900719925474099303n);
  });
  it("vincula la empresa y los filtros sin interpolar texto del usuario", () => {
    const inyeccion = "' OR 1=1 --";
    const c = consultaAnalisis(empresa, {
      ...filtros,
      alcance: "empresa",
      organismo: inyeccion,
    });
    expect(c.sql).not.toContain(inyeccion);
    expect(c.parametros).toContain(inyeccion);
    expect(c.parametros[4]).toBe(empresa);
    expect(c.sql).toContain("FROM perfil p");
    expect(c.sql).toContain("esPrueba");
    expect(c.sql).toContain("America/Santiago");
  });
  it("usa una instantánea y denominadores conocidos, y conserva regiones sin identificar", async () => {
    const query = vi.fn().mockResolvedValue([{ datos: datos() }]);
    const r = await new AnalisisMercadoService({
      query,
    } as unknown as DataSource).consultar(empresa, filtros);
    expect(query).toHaveBeenCalledTimes(1);
    expect(r.metricas.medianaOferentes).toBe(2.5);
    expect(r.metricas.porcentajeBajaParticipacion).toBe(50);
    expect(r.metricas.tasaDesiertas).toBe(20);
    expect(r.cobertura.porcentajeResultados).toBe(60);
    expect(r.comparacion.publicadas.variacion).toBe(100);
    expect(r.comparacion.monto.variacion).toBe(50);
    expect(r.regiones.datos).toHaveLength(16);
    expect(
      r.regiones.datos.find((v) => v.codigo === "metropolitana"),
    ).toMatchObject({ cantidad: 12, nivel: "alta" });
    expect(r.regiones.datos.find((v) => v.codigo === "aysen")).toMatchObject({
      cantidad: 2,
      nivel: "baja",
    });
    expect(r.regiones.sinRegion).toBe(6);
    expect(r.evolucion.reduce((n, v) => n + v.cantidad, 0)).toBe(20);
    expect(r.proveedores).toHaveLength(0);
  });
  it("no reemplaza una selección sin datos con proveedores de otro período", async () => {
    const d = datos();
    d.totales = [];
    const query = vi.fn().mockResolvedValue([{ datos: d }]);
    const r = await new AnalisisMercadoService({
      query,
    } as unknown as DataSource).consultar(empresa, filtros);
    expect(r.metricas.publicadas).toBe(0);
    expect(r.metricas.montoAdjudicado).toBeNull();
    expect(r.metricas.medianaOferentes).toBeNull();
    expect(r.metricas.tasaDesiertas).toBeNull();
    expect(r.metricas.porcentajeBajaParticipacion).toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
    expect(r.proveedores).toEqual([]);
  });
});
