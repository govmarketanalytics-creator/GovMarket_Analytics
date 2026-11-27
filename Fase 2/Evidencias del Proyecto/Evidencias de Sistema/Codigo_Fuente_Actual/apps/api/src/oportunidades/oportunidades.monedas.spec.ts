import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Repository } from 'typeorm';
import { Licitacion } from '../licitaciones/entities/licitacion.entity';
import { PerfilesEmpresaService } from '../perfiles-empresa/perfiles-empresa.service';
import { PlanesEmpresaService } from '../planes-empresa/planes-empresa.service';
import { OportunidadesService } from './oportunidades.service';
import { agruparEvolucionDashboard, agruparOrganismosDashboard, mapearMontosDashboard,
  MONEDA_DASHBOARD_SQL, type MontoDashboardRaw } from './montos-dashboard';

const fila = (moneda: string | null, monto: string | null, cantidad = '1', conMonto = '1'): MontoDashboardRaw =>
  ({ moneda, monto, cantidad, conMonto });

describe('Montos del dashboard separados por unidad', () => {
  it('conserva CLP, UF, UTM y USD sin producir una suma cruzada', () => {
    const r = mapearMontosDashboard([fila('CLP', '12000000.00'), fila('CLF', '100.00'), fila('UTM', '20.00'), fila('USD', '4000.00')]);
    expect(r.map((g) => [g.moneda, g.montoTotal])).toEqual([
      ['CLP', '12000000.00'], ['CLF', '100.00'], ['UTM', '20.00'], ['USD', '4000.00'],
    ]);
  });
  it('mantiene decimales exactos incluso sobre el limite entero seguro de JavaScript', () => {
    expect(mapearMontosDashboard([fila('CLP', '999999999999999999.99')])[0].montoTotal).toBe('999999999999999999.99');
  });
  it('diferencia cero informado de suma sin datos', () => {
    const r = mapearMontosDashboard([fila('CLP', '0.00'), fila('CLF', null, '2', '0')]);
    expect(r[0]).toMatchObject({ montoTotal: '0.00', conMonto: 1, sinMonto: 0 });
    expect(r[1]).toMatchObject({ montoTotal: null, cantidad: 2, conMonto: 0, sinMonto: 2 });
  });
  it('la suma parcial revela cuantos procesos no informaron monto', () => {
    expect(mapearMontosDashboard([fila('CLP', '100.50', '4', '2')])[0]).toMatchObject({
      montoTotal: '100.50', cantidad: 4, conMonto: 2, sinMonto: 2,
    });
  });
  for (const moneda of [null, 'QA-UNIDAD', 'OTRA']) {
    it(`no inventa pesos ni totaliza una unidad no validada: ${moneda}`, () => {
      expect(mapearMontosDashboard([fila(moneda, '150.00')])[0]).toEqual({
        moneda, monedaReconocida: false, montoTotal: null, cantidad: 1, conMonto: 1, sinMonto: 0,
      });
    });
  }
  for (const monto of [null, 'NaN', 'Infinity', '1e8', 'no informado']) {
    it(`no convierte un importe no interpretable en cero: ${monto}`, () => {
      expect(mapearMontosDashboard([fila('CLP', monto)])[0].montoTotal).toBeNull();
    });
  }
  it('deja el conjunto sin importes vacio, sin un total artificial cero', () => {
    expect(mapearMontosDashboard([])).toEqual([]);
  });
  it('ordena grupos sin mutar los valores de origen', () => {
    const original = [fila('USD', '2.00'), fila('CLP', '3.00')];
    const copia = structuredClone(original);
    expect(mapearMontosDashboard(original).map((g) => g.moneda)).toEqual(['CLP', 'USD']);
    expect(original).toEqual(copia);
  });
  it('solo identifica UF como alias de CLF en la agrupacion, sin tasa de conversion', () => {
    expect(MONEDA_DASHBOARD_SQL).toContain("= 'UF' THEN 'CLF'");
    expect(MONEDA_DASHBOARD_SQL).toContain('BTRIM(licitacion.moneda)');
    expect(MONEDA_DASHBOARD_SQL).not.toMatch(/\*|\//);
  });
  it('mantiene separados los importes de cada mes y no rellena ausencias con cero', () => {
    const r = agruparEvolucionDashboard([
      { ...fila('CLF', '10.00'), periodo: '2026-11' },
      { ...fila('CLP', null, '2', '0'), periodo: '2026-10' },
      { ...fila('CLP', '20.00'), periodo: '2026-11' },
    ]);
    expect(r.map((m) => m.periodo)).toEqual(['2026-10', '2026-11']);
    expect(r.every((m) => m.monto === null)).toBe(true);
    expect(r[0].montosPorMoneda[0].montoTotal).toBeNull();
    expect(r[1].montosPorMoneda.map((g) => g.montoTotal)).toEqual(['20.00', '10.00']);
  });
  it('ordena compradores por cantidad, no por magnitudes de monedas incomparables', () => {
    const r = agruparOrganismosDashboard([
      { ...fila('CLP', '1.00', '2', '1'), nombre: 'Comprador A' },
      { ...fila('USD', '999999999.00'), nombre: 'Comprador B' },
      { ...fila('CLF', '1.00'), nombre: 'Comprador A' },
    ]);
    expect(r.map((o) => [o.nombre, o.cantidad, o.monto])).toEqual([
      ['Comprador A', 3, null], ['Comprador B', 1, null],
    ]);
    expect(r[0].montosPorMoneda).toHaveLength(2);
  });
  it('los cinco compradores se recortan despues de consolidar todas sus monedas', () => {
    const datos = Array.from({ length: 8 }, (_, i) => ({ ...fila('CLP', '10.00'), nombre: `Comprador ${i}` }));
    datos.push({ ...fila('CLF', '0.00', '3', '3'), nombre: 'Comprador 7' });
    const r = agruparOrganismosDashboard(datos);
    expect(r).toHaveLength(5); expect(r[0].nombre).toBe('Comprador 7'); expect(r[0].cantidad).toBe(4);
  });
});

describe('Contrato monetario y SQL del resumen de oportunidades', () => {
  let servicio: OportunidadesService;
  let consultas: string[];
  beforeEach(() => {
    consultas = [];
    const query = vi.fn(async (sql: string) => {
      consultas.push(sql);
      return [{ generadoEn: '2026-11-17T12:00:00Z', catalogoConsultadoEn: null, ultimoDetalleEn: null,
        oportunidadesActivas: 5, oportunidadesConMonto: 4, oportunidadesSinMonto: 1,
        conDetalle: 4, nuevasSemana: 2, cierran48Horas: 1, cierranSemana: 3,
        baseCompradores: 1, organismosCompradores: 1, baseRegiones: 0, baseCategorias: 0,
        cierran2a7Dias: 2, cierran7a30Dias: 1, cierran30DiasMas: 1,
        montos: [fila('CLP', '10.00', '2', '1'), fila('CLF', '20.00'), fila('USD', '30.00'), fila('QA-UNIDAD', null)],
        meses: [{ ...fila('CLP', '10.00'), periodo: '2026-11' }, { ...fila('CLF', '20.00'), periodo: '2026-11' }],
        compradores: [{ ...fila('USD', '30.00'), codigo: 'A', nombre: 'Comprador A' }],
        categorias: [], regiones: [], agenda: [], publicaciones: [] }];
    });
    servicio = new OportunidadesService({ query } as unknown as Repository<Licitacion>,
      { obtener: vi.fn().mockResolvedValue({ activo: false }) } as unknown as PerfilesEmpresaService,
      { esPremiumVigente: vi.fn().mockResolvedValue(true) } as unknown as PlanesEmpresaService);
  });
  it('retira la cifra escalar antigua y entrega grupos exactos y cobertura', async () => {
    const r = await servicio.obtenerResumenDashboard('empresa-ficticia');
    expect(r.versionContrato).toBe(3); expect(r.metricas.montoTotalDisponible).toBeNull();
    expect(r.tratamientoMonetario.conversionAPesos).toBe(false);
    expect(r.metricas.montosPorMoneda.map((g) => g.montoTotal)).toEqual(['10.00', '20.00', '30.00', null]);
    expect(r.metricas.oportunidadesSinMonto).toBe(1);
  });
  it('no devuelve sumas mezcladas en meses ni en compradores', async () => {
    const r = await servicio.obtenerResumenDashboard('empresa-ficticia');
    expect(r.evolucionMontos[0].monto).toBeNull(); expect(r.organismos[0].monto).toBeNull();
    expect(r.evolucionMontos[0].montosPorMoneda).toHaveLength(2);
    expect(r.tratamientoMonetario.rankingOrganismos).toBe('cantidad_oportunidades');
  });
  it('mantiene vigencia y exclusion en una sola instantanea SQL compartida por todos los paneles', async () => {
    await servicio.obtenerResumenDashboard('empresa-ficticia');
    expect(consultas).toHaveLength(1);
    expect(consultas[0]).toContain('WITH vigentes AS MATERIALIZED');
    expect(consultas[0]).toContain('licitacion.activa_en_listado = true');
    expect(consultas[0]).toContain('licitacion.codigo_estado = $1');
    expect(consultas[0]).toContain('licitacion.fecha_cierre >= now()');
    expect(consultas[0]).toContain("->> 'esPrueba'");
  });
  it('todas las sumas estan agrupadas por unidad y nunca COALESCE a cero', async () => {
    await servicio.obtenerResumenDashboard('empresa-ficticia');
    const sql = consultas[0];
    expect(sql.match(/SUM\(/g)).toHaveLength(3);
    expect(sql.match(/ELSE NULL END AS monto/g)).toHaveLength(3);
    expect(sql).not.toContain('COALESCE(SUM');
    expect(sql).toContain('GROUP BY "monedaCanonica"');
    expect(sql).toContain('GROUP BY periodo, "monedaCanonica"');
    expect(sql).toContain('GROUP BY n.codigo, n.nombre, v."monedaCanonica"');
  });
  it('mantiene America/Santiago en la trazabilidad mensual, sin graficarla como tendencia', async () => {
    await servicio.obtenerResumenDashboard('empresa-ficticia');
    expect(consultas[0]).toContain("fecha_publicacion AT TIME ZONE 'America/Santiago', 'YYYY-MM'");
    expect(consultas[0]).toContain("date_trunc('month', now() AT TIME ZONE 'America/Santiago')");
  });
});
