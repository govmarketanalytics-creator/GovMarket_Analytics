import { describe, expect, it, vi, afterEach } from "vitest";
import {
  celdaCsv,
  diaChile,
  montoMercado,
  rangoMercado,
} from "../../../web/src/market-analysis/modeloMercado";

afterEach(() => vi.useRealTimers());
describe("Exportación y fechas del análisis de mercado", () => {
  it.each([
    '=HYPERLINK("https://ejemplo.cl")',
    "+SUM(1;1)",
    "-CMD",
    "@SUM(1;1)",
    " \t=1+1",
  ])("neutraliza una fórmula CSV: %s", (valor) => {
    expect(celdaCsv(valor)).toMatch(/^"'/);
  });
  it("escapa separadores y comillas sin perder el texto", () => {
    expect(celdaCsv('Comprador "A"; TI')).toBe('"Comprador ""A""; TI"');
    expect(celdaCsv(null)).toBe('""');
    expect(celdaCsv(0)).toBe('"0"');
  });
  it("mantiene los centavos y los enteros fuera del rango seguro de Number", () => {
    expect(montoMercado("9007199254740993.01", "CLP")).toBe(
      "$9.007.199.254.740.993,01",
    );
    expect(montoMercado("0.00", "CLP")).toBe("$0");
    expect(montoMercado(null, "USD")).toBe("Sin datos");
    expect(montoMercado("2.50", "CLF")).toBe("UF 2,50");
  });
  it("usa el día de Chile al cruzar la medianoche UTC y rangos inclusivos", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T02:30:00Z"));
    expect(diaChile()).toBe("2025-12-31");
    expect(rangoMercado(1)).toEqual({
      fechaDesde: "2025-12-31",
      fechaHasta: "2025-12-31",
    });
    expect(rangoMercado(2)).toEqual({
      fechaDesde: "2025-12-30",
      fechaHasta: "2025-12-31",
    });
  });
});
