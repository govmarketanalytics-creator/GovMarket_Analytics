import { useState } from 'react';
import './SelectorOfertas.css';

export interface OfertaCatalogo {
  id: string; rubro: string; linea: string; especialidad: string; nombre: string;
  tipo: 'servicio' | 'producto' | 'obra'; codigosCategoria: string[];
}
const unicos = (valores: string[]) => [...new Set(valores)].sort((a,b) => a.localeCompare(b,'es'));
export function SelectorOfertas({ ofertas, seleccionadas, onCambiar, cargando }: {
  ofertas: OfertaCatalogo[]; seleccionadas: string[];
  onCambiar: (ids: string[]) => void; cargando: boolean;
}) {
  const [rubro, setRubro] = useState('');
  const [linea, setLinea] = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const delRubro = ofertas.filter(o => o.rubro === rubro);
  const deLinea = delRubro.filter(o => o.linea === linea);
  const disponibles = deLinea.filter(o => o.especialidad === especialidad);
  const alternar = (id: string) => onCambiar(seleccionadas.includes(id)
    ? seleccionadas.filter(v => v !== id) : [...seleccionadas,id]);
  return <section className="nexus-selector" aria-label="Ofertas específicas de tu empresa">
    <h3>¿Qué servicios o productos ofrece tu empresa?</h3>
    <p>Explora los niveles y selecciona las ofertas que puedes entregar. Puedes combinar varias especialidades.</p>
    <div className="nexus-selector-path">
      <label>Rubro<select value={rubro} onChange={e=>{setRubro(e.target.value);setLinea('');setEspecialidad('');}}>
        <option value="">Selecciona un rubro</option>{unicos(ofertas.map(o=>o.rubro)).map(v=><option key={v}>{v}</option>)}
      </select></label>
      <label>Línea de oferta<select value={linea} disabled={!rubro} onChange={e=>{setLinea(e.target.value);setEspecialidad('');}}>
        <option value="">Selecciona una línea</option>{unicos(delRubro.map(o=>o.linea)).map(v=><option key={v}>{v}</option>)}
      </select></label>
      <label>Especialidad<select value={especialidad} disabled={!linea} onChange={e=>setEspecialidad(e.target.value)}>
        <option value="">Selecciona una especialidad</option>{unicos(deLinea.map(o=>o.especialidad)).map(v=><option key={v}>{v}</option>)}
      </select></label>
    </div>
    {cargando ? <p role="status">Cargando ofertas…</p>
      : ofertas.length===0 ? <p role="alert">No se pudo cargar el catálogo de ofertas. Recarga para volver a intentarlo.</p>
      : especialidad ? <fieldset className="nexus-offers"><legend>Ofertas concretas</legend>
        {disponibles.map(o=><label key={o.id}><input type="checkbox" checked={seleccionadas.includes(o.id)}
          disabled={seleccionadas.length>=50 && !seleccionadas.includes(o.id)} onChange={()=>alternar(o.id)} /><span><strong>{o.nombre}</strong><small>{o.tipo === 'obra' ? 'Obra' : o.tipo === 'producto' ? 'Producto' : 'Servicio'}</small></span></label>)}
      </fieldset> : <p className="nexus-selector-hint">Selecciona los tres niveles para ver las ofertas disponibles.</p>}
    <h4>Etiquetas de tus ofertas ({seleccionadas.length})</h4>
    <div className="nexus-selected" aria-live="polite">{seleccionadas.length===0 ? <p>Aún no has seleccionado ofertas específicas.</p>
      : seleccionadas.map(id=>{const o=ofertas.find(v=>v.id===id);return <div key={id}>
        <span><strong>{o?.nombre ?? 'Oferta no disponible'}</strong>{o&&<small>{o.rubro} · {o.linea} · {o.especialidad}</small>}</span>
        <button type="button" aria-label={`Quitar ${o?.nombre ?? id}`} onClick={()=>alternar(id)}>×</button>
      </div>;})}</div>
    <p className="nexus-selector-hint">Cada etiqueta conserva su ruta de rubro, línea y especialidad. Las etiquetas complementarias y las palabras clave priorizan coincidencias con estas ofertas.</p>
  </section>;
}
