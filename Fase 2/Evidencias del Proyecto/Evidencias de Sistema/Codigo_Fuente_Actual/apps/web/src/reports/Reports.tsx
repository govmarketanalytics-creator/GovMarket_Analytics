import { useState } from "react";
import "./Reports.css";

interface ReportsProps {
  nombreEmpresa?: string | null;
}

const reportes = [
  { icono: "▦", titulo: "Resumen ejecutivo", descripcion: "Indicadores generales, montos y evolución del mercado público." },
  { icono: "◎", titulo: "Oportunidades por región", descripcion: "Distribución territorial de licitaciones y concentración regional." },
  { icono: "◫", titulo: "Organismos compradores", descripcion: "Principales instituciones, volumen de compra y participación." },
  { icono: "♙", titulo: "Proveedores adjudicados", descripcion: "Empresas proveedoras, montos y cantidad de adjudicaciones." },
];

export function Reports({ nombreEmpresa }: ReportsProps) {
  const [aviso, setAviso] = useState(false);

  function mostrarAviso() {
    setAviso(true);
    window.setTimeout(() => setAviso(false), 3500);
  }

  return (
    <div className="reports-page">
      <section className="reports-heading">
        <div><span>DOCUMENTOS Y EXPORTACIONES</span><h1>Reportes</h1><p>Vista demostrativa de los informes que podrá generar {nombreEmpresa || "tu empresa"}.</p></div>
        <div className="reports-export-actions"><button type="button" onClick={mostrarAviso}>⇩ Exportar Excel</button><button type="button" onClick={mostrarAviso}>▧ Exportar PDF</button></div>
      </section>

      <section className="reports-filter-card">
        <label><span>Período</span><select defaultValue="mes"><option value="mes">Este mes</option><option value="trimestre">Último trimestre</option><option value="anio">Este año</option></select></label>
        <label><span>Tipo de reporte</span><select defaultValue="todos"><option value="todos">Todos los reportes</option><option value="mercado">Análisis de mercado</option><option value="oportunidades">Oportunidades</option></select></label>
        <label><span>Formato</span><select defaultValue="pdf"><option value="pdf">PDF</option><option value="excel">Excel</option></select></label>
        <button type="button" onClick={mostrarAviso}>Aplicar filtros</button>
      </section>

      <section className="reports-grid">
        {reportes.map((reporte) => (
          <article key={reporte.titulo}>
            <span>{reporte.icono}</span>
            <div><h2>{reporte.titulo}</h2><p>{reporte.descripcion}</p></div>
            <button type="button" onClick={mostrarAviso}>Generar reporte <b>→</b></button>
          </article>
        ))}
      </section>

      <section className="recent-reports-card">
        <header><div><h2>Reportes recientes</h2><p>Ejemplos de la información que quedará disponible.</p></div><span>Función demostrativa</span></header>
        <div className="recent-reports-table">
          <div className="is-head"><span>Reporte</span><span>Período</span><span>Formato</span><span>Estado</span><span>Acción</span></div>
          <div><span><b>Resumen ejecutivo mensual</b><small>Mercado público</small></span><span>Octubre 2026</span><span>PDF</span><span><i>Ejemplo</i></span><button type="button" onClick={mostrarAviso}>Ver</button></div>
          <div><span><b>Oportunidades por región</b><small>Distribución territorial</small></span><span>Octubre 2026</span><span>Excel</span><span><i>Ejemplo</i></span><button type="button" onClick={mostrarAviso}>Ver</button></div>
          <div><span><b>Ranking de proveedores</b><small>Adjudicaciones</small></span><span>Octubre 2026</span><span>PDF</span><span><i>Ejemplo</i></span><button type="button" onClick={mostrarAviso}>Ver</button></div>
        </div>
      </section>

      {aviso && <div className="reports-toast" role="status"><strong>Funcionalidad demostrativa</strong><span>La generación y descarga de reportes se incorporará en una próxima etapa.</span></div>}
    </div>
  );
}
