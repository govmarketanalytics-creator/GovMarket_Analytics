interface AvisoConsultaProps {
  error: string;
  cargando: boolean;
  hayResultadosAnteriores: boolean;
  onReintentar: () => void;
}

export function AvisoConsulta({ error, cargando, hayResultadosAnteriores, onReintentar }: AvisoConsultaProps) {
  return (
    <div className="gm-query-error" role="alert">
      <p>{error}</p>
      {hayResultadosAnteriores && (
        <p>Se muestra la última consulta confirmada. Sus resultados pueden haber cambiado; vuelve a actualizarlos antes de decidir.</p>
      )}
      <button className="gm-outline-button" type="button" disabled={cargando} onClick={onReintentar}>
        {cargando ? 'Reintentando…' : 'Reintentar búsqueda'}
      </button>
    </div>
  );
}
