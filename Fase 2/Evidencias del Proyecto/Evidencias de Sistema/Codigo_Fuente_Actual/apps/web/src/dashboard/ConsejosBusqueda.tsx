import type { EstadoOnboarding } from '../onboarding/Onboarding';
import './ConsejosBusqueda.css';

interface Props {
  perfil: EstadoOnboarding['perfil'];
  onBuscar: () => void;
  onEditarPerfil: () => void;
}

export function ConsejosBusqueda({ perfil, onBuscar, onEditarPerfil }: Props) {
  const capacidades = (perfil?.etiquetasCapacidades?.length ?? 0) + (perfil?.palabrasClave?.length ?? 0);
  return <aside className="mailbox-search-tips" aria-label="Consejos para mejorar tu búsqueda">
    <header><span aria-hidden="true">✦</span><h3>Consejos para tu búsqueda</h3><small>Orientación · no es una nueva licitación</small></header>
    <article><strong>Empieza por un producto o servicio concreto</strong>
      <p>Busca un término específico y luego acota con los filtros de región y categoría. El buscador general permite explorar otros rubros, aunque no coincidan con tu perfil.</p>
      <button type="button" onClick={onBuscar}>Abrir buscador general →</button>
    </article>
    <article><strong>{capacidades ? 'Mantén tu perfil alineado con lo que ofreces' : 'Completa tus capacidades antes de interpretar el match'}</strong>
      <p>{capacidades
        ? 'Revisa que tus palabras y capacidades describan servicios que realmente puedes entregar. El porcentaje de compatibilidad no es una probabilidad de adjudicación.'
        : 'Indicar una región no demuestra afinidad comercial. Agrega productos o servicios concretos y revisa siempre las bases de cada proceso.'}</p>
      <button type="button" onClick={onEditarPerfil}>Revisar perfil empresarial →</button>
    </article>
    <p className="mailbox-search-tips-note">Orientación de GovMarket para ayudarte a explorar el catálogo y preparar tu evaluación.</p>
  </aside>;
}
