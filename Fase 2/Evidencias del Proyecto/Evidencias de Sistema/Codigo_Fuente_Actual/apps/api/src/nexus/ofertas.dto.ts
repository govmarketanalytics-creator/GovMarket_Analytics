import { z } from 'zod';
import { OFERTAS_POR_ID } from './catalogo-nexus';
export const ofertasIdsSchema = z.array(z.string().max(100).refine(id => OFERTAS_POR_ID.has(id),
  'Selecciona una oferta específica válida del catálogo')).max(50).transform(ids => [...new Set(ids)]);
