import type { NivelConcentracion } from "./types";

interface RegionMapa {
  codigo: string;
  nombre: string;
  cantidad: number;
  nivel: NivelConcentracion;
}

interface ChileMapProps {
  regiones: RegionMapa[];
  regionSeleccionada?: string;
  onSeleccionar?: (nombre: string) => void;
  compacto?: boolean;
  unidadConteo?: string;
}

const formas: Array<{ codigo: string; d: string }> = [
  {
    codigo: "arica",
    d: "M91 10 L116 19 L113 47 L89 43 L86 30 Z",
  },
  {
    codigo: "tarapaca",
    d: "M89 43 L113 47 L112 86 L84 82 L80 65 Z",
  },
  {
    codigo: "antofagasta",
    d: "M84 82 L112 86 L109 154 L102 181 L77 172 L72 142 L78 119 Z",
  },
  {
    codigo: "atacama",
    d: "M77 172 L102 181 L105 225 L97 248 L72 239 L67 214 L73 193 Z",
  },
  {
    codigo: "coquimbo",
    d: "M72 239 L97 248 L99 287 L92 311 L68 302 L64 282 L69 260 Z",
  },
  {
    codigo: "valparaiso",
    d: "M68 302 L92 311 L93 340 L86 352 L65 344 L61 327 Z M25 322 l8 -5 7 6 -5 8 -9 -2 Z",
  },
  {
    codigo: "metropolitana",
    d: "M67 319 L93 326 L94 359 L86 371 L70 365 L64 346 Z",
  },
  {
    codigo: "ohiggins",
    d: "M65 344 L86 352 L91 385 L83 403 L62 394 L58 373 Z",
  },
  {
    codigo: "maule",
    d: "M62 394 L83 403 L86 443 L78 462 L57 452 L53 427 Z",
  },
  {
    codigo: "nuble",
    d: "M57 452 L78 462 L79 482 L73 491 L53 483 L50 468 Z",
  },
  {
    codigo: "biobio",
    d: "M53 483 L73 491 L77 527 L68 544 L48 535 L44 510 Z",
  },
  {
    codigo: "araucania",
    d: "M48 535 L68 544 L72 583 L63 599 L44 590 L40 562 Z",
  },
  {
    codigo: "los-rios",
    d: "M44 590 L63 599 L67 626 L58 638 L41 629 L37 608 Z",
  },
  {
    codigo: "los-lagos",
    d: "M41 629 L58 638 L61 670 L54 687 L58 707 L48 719 L42 700 L32 692 L36 674 L29 660 Z M22 676 l7 -5 5 10 -5 11 -8 -6 Z",
  },
  {
    codigo: "aysen",
    d: "M48 719 L58 707 L66 729 L60 748 L69 765 L61 785 L67 802 L54 818 L45 805 L39 785 L43 767 L34 748 L39 734 Z M29 716 l8 -8 5 12 -7 13 -9 -6 Z M24 743 l7 -5 5 11 -7 9 -7 -6 Z M27 774 l8 -7 5 12 -7 11 -8 -6 Z",
  },
  {
    codigo: "magallanes",
    d: "M54 818 L67 802 L77 815 L91 821 L104 837 L128 845 L146 864 L137 878 L113 870 L95 855 L75 851 L64 838 L52 842 L43 830 Z M78 858 l16 5 11 14 -14 9 -15 -10 Z M112 878 l15 -3 13 12 -11 11 -17 -7 Z",
  },
];

export function ChileMap({
  regiones,
  regionSeleccionada,
  onSeleccionar,
  compacto = false,
  unidadConteo = 'licitaciones',
}: ChileMapProps) {
  const porCodigo = new Map(regiones.map((region) => [region.codigo, region]));

  function seleccionar(codigo: string) {
    const region = porCodigo.get(codigo);
    if (region && onSeleccionar) onSeleccionar(region.nombre);
  }

  return (
    <div className={`chile-map${compacto ? " chile-map--compact" : ""}`}>
      <svg
        viewBox="0 0 165 910"
        role="img"
        aria-label="Mapa de Chile con concentración de licitaciones por región"
      >
        <g className="chile-map-regions">
          {formas.map((forma) => {
            const region = porCodigo.get(forma.codigo);
            const seleccionada = regionSeleccionada === region?.nombre;
            return (
              <path
                key={forma.codigo}
                d={forma.d}
                className={`is-${region?.nivel ?? "sin_datos"}${seleccionada ? " is-selected" : ""}`}
                role={onSeleccionar ? "button" : undefined}
                tabIndex={onSeleccionar ? 0 : undefined}
                aria-label={`${region?.nombre ?? forma.codigo}: ${region?.cantidad ?? 0} ${unidadConteo}`}
                onClick={() => seleccionar(forma.codigo)}
                onKeyDown={(evento) => {
                  if (evento.key === "Enter" || evento.key === " ") {
                    evento.preventDefault();
                    seleccionar(forma.codigo);
                  }
                }}
              >
                <title>
                  {`${region?.nombre ?? forma.codigo}: ${region?.cantidad ?? 0} ${unidadConteo}`}
                </title>
              </path>
            );
          })}
        </g>
        <g className="chile-map-islands" aria-hidden="true">
          <circle cx="22" cy="307" r="4" />
          <circle cx="17" cy="314" r="2" />
          <circle cx="72" cy="842" r="3" />
          <circle cx="89" cy="849" r="2" />
        </g>
      </svg>
    </div>
  );
}
