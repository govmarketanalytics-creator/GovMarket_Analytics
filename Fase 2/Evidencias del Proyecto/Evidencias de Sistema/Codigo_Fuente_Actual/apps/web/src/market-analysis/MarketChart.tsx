import { useId } from "react";
import { fechaChile, numeroMercado } from "./modeloMercado";
import type { RespuestaAnalisisMercado } from "./types";

export function MarketChart({
  respuesta: r,
  modo,
}: {
  respuesta: RespuestaAnalisisMercado;
  modo: "monto" | "cantidad";
}) {
  const uid = "mercado-" + useId().replaceAll(":", "");
  const actual = r.evolucion.map((e) =>
    modo === "monto" ? (e.monto === null ? null : Number(e.monto)) : e.cantidad,
  );
  const anterior = r.evolucion.map((e) =>
    modo === "monto"
      ? e.anteriorMonto === null
        ? null
        : Number(e.anteriorMonto)
      : e.anteriorCantidad,
  );
  const todos = [...actual, ...anterior].filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  if (!todos.length)
    return (
      <div className="ma-empty">
        No hay montos completos en {r.filtrosAplicados.moneda} para graficar.
        Puedes consultar las publicaciones.
      </div>
    );
  const max = Math.max(...todos, modo === "cantidad" ? 5 : 1);
  const x = (i: number) => 74 + (i * 606) / Math.max(r.evolucion.length - 1, 1);
  const y = (v: number) => 224 - (v / max) * 182;
  const segmentos = (valores: Array<number | null>) => {
    const partes: Array<Array<[number, number]>> = [];
    let parte: Array<[number, number]> = [];
    valores.forEach((v, i) => {
      if (v === null) {
        if (parte.length) partes.push(parte);
        parte = [];
      } else parte.push([x(i), y(v)]);
    });
    if (parte.length) partes.push(parte);
    return partes;
  };
  const ruta = (p: Array<[number, number]>) =>
    p.map(([a, b], i) => (i ? "L" : "M") + a + "," + b).join(" ");
  const compacto = (v: number) =>
    new Intl.NumberFormat("es-CL", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(v);
  return (
    <>
      <svg
        className="ma-chart"
        viewBox="0 0 710 275"
        role="img"
        aria-labelledby={uid + "-titulo " + uid + "-desc"}
      >
        <title id={uid + "-titulo"}>
          {modo === "monto"
            ? "Montos adjudicados asociados a la fecha de publicación"
            : "Licitaciones por fecha de publicación"}
        </title>
        <desc id={uid + "-desc"}>
          Comparación por tramos de {r.periodoAnterior.diasPorTramo} días. Los
          importes ausentes se muestran como interrupciones. Los valores también
          están disponibles en la tabla.
        </desc>
        <defs>
          <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a9874" stopOpacity=".24" />
            <stop offset="100%" stopColor="#0a9874" stopOpacity=".015" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line
              x1="74"
              x2="680"
              y1={42 + i * 45.5}
              y2={42 + i * 45.5}
              stroke="#e9eef2"
            />
            <text x="63" y={47 + i * 45.5} textAnchor="end">
              {compacto(max * (1 - i / 4))}
            </text>
          </g>
        ))}
        {segmentos(actual)
          .filter((p) => p.length > 1)
          .map((p, i) => (
            <path
              key={"f" + i}
              d={ruta(p) + " L" + p.at(-1)![0] + ",224 L" + p[0][0] + ",224 Z"}
              fill={"url(#" + uid + ")"}
            />
          ))}
        {segmentos(anterior).map((p, i) => (
          <path
            key={"a" + i}
            d={ruta(p)}
            fill="none"
            stroke="#8a9cac"
            strokeWidth="2"
            strokeDasharray="6 5"
          />
        ))}
        {segmentos(actual).map((p, i) => (
          <path
            key={"p" + i}
            d={ruta(p)}
            fill="none"
            stroke="#078464"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        ))}
        {actual.map((v, i) =>
          v === null ? null : (
            <circle
              key={i}
              cx={x(i)}
              cy={y(v)}
              r="4"
              fill="white"
              stroke="#078464"
              strokeWidth="2"
            >
              <title>
                {fechaChile(r.evolucion[i].periodo)}: {numeroMercado(v)}{" "}
                {modo === "monto" ? r.filtrosAplicados.moneda : "publicaciones"}
              </title>
            </circle>
          ),
        )}
        {r.evolucion.map((e, i) => (
          <text key={e.periodo} x={x(i)} y="250" textAnchor="middle">
            {new Intl.DateTimeFormat("es-CL", {
              day: "2-digit",
              month: "short",
              timeZone: "America/Santiago",
            }).format(new Date(e.periodo + "T12:00:00Z"))}
          </text>
        ))}
      </svg>
      <div className="ma-legend">
        <span>
          <i />
          Período seleccionado
        </span>
        <span>
          <i className="ma-dashed" />
          Período anterior
        </span>
      </div>
      <details className="ma-data-table">
        <summary>Ver tabla del gráfico</summary>
        <div
          className="ma-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Datos de la evolución"
        >
          <table>
            <thead>
              <tr>
                <th>Inicio del tramo</th>
                <th>Publicadas</th>
                <th>Anteriores</th>
                <th>Monto {r.filtrosAplicados.moneda}</th>
              </tr>
            </thead>
            <tbody>
              {r.evolucion.map((e) => (
                <tr key={e.periodo}>
                  <td>{fechaChile(e.periodo)}</td>
                  <td>{numeroMercado(e.cantidad)}</td>
                  <td>{numeroMercado(e.anteriorCantidad)}</td>
                  <td>{e.monto ?? "Sin datos"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
