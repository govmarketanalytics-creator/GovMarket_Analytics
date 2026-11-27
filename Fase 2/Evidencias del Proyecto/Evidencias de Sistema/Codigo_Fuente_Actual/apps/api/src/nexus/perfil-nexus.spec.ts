import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataSource, Repository } from 'typeorm';
import { OnboardingService } from '../onboarding/onboarding.service';
import { PerfilesEmpresaService } from '../perfiles-empresa/perfiles-empresa.service';
import { PerfilEmpresa } from '../perfiles-empresa/entities/perfil-empresa.entity';
import { MembresiaEmpresa } from '../membresias/entities/membresia-empresa.entity';
import type { PlanesEmpresaService } from '../planes-empresa/planes-empresa.service';
import { guardarPerfilEmpresaSchema } from '../perfiles-empresa/dto/guardar-perfil-empresa.dto';
import { guardarEtiquetasCapacidadesSchema } from '../onboarding/dto/guardar-etiquetas-capacidades.dto';

describe('Perfil NEXUS: escritura, relectura y preferencias conservadas', () => {
  let fila: PerfilEmpresa;
  let repo: Repository<PerfilEmpresa>;
  let servicio: PerfilesEmpresaService;
  beforeEach(() => {
    vi.stubEnv('NEXUS_REDUCIDO_HABILITADO','true');
    fila = Object.assign(new PerfilEmpresa(), { id:'P',empresaId:'E',ofertasIds:[],
      etiquetasCapacidades:['Salud mental'],palabrasClave:['informatica'],codigosCategoria:['860000'],
      regiones:['Metropolitana'],montoMinimo:null,montoMaximo:null,incluirSinMonto:true,
      puntajeMinimoAlerta:'60',activo:true,tiposOportunidad:['licitacion_publica'],
      frecuenciaAlertas:'diaria',creadoEn:new Date('2026-01-01'),actualizadoEn:new Date('2026-01-01') });
    repo = {findOne:vi.fn(async()=>fila),merge:vi.fn((original,cambios)=>Object.assign({},original,cambios)),
      save:vi.fn(async(nuevo)=>{fila=Object.assign(new PerfilEmpresa(),nuevo,{actualizadoEn:new Date()});return fila;})} as unknown as Repository<PerfilEmpresa>;
    servicio = new PerfilesEmpresaService(repo);
  });
  afterEach(()=>vi.unstubAllEnvs());
  it('la ruta de perfil admite ofertas y no borra campos omitidos',async()=>{
    const datos=guardarPerfilEmpresaSchema.parse({ofertasIds:['salud.psicologia']});
    await servicio.guardar('E',datos);
    const releido=await servicio.obtener('E');
    expect(releido.ofertasIds).toEqual(['salud.psicologia']);
    expect(releido.etiquetasCapacidades).toEqual(['Salud mental']);
    expect(releido.palabrasClave).toEqual(['informatica']);expect(releido.regiones).toEqual(['Metropolitana']);
    expect(releido.codigosCategoria).toEqual(['860000']);expect(releido.nexusHabilitado).toBe(true);
  });
  it('permite borrar palabras clave sólo si se envía explícitamente el arreglo vacío',async()=>{
    await servicio.guardar('E',guardarPerfilEmpresaSchema.parse({ofertasIds:['salud.psicologia'],palabrasClave:[]}));
    expect((await servicio.obtener('E')).palabrasClave).toEqual([]);
  });
  it('editar etiquetas conserva las ofertas seleccionadas y las preferencias',async()=>{
    fila.ofertasIds=['salud.psicologia'];
    await servicio.guardar('E',guardarPerfilEmpresaSchema.parse({etiquetasCapacidades:['Telepsicología','ISO 9001']}));
    const releido=await servicio.obtener('E');
    expect(releido.ofertasIds).toEqual(['salud.psicologia']);
    expect(releido.etiquetasCapacidades).toEqual(['Telepsicología','ISO 9001']);
    expect(releido.palabrasClave).toEqual(['informatica']);
    expect(releido.regiones).toEqual(['Metropolitana']);
  });
  it('borrar etiquetas explícitamente no elimina ofertas ni palabras clave',async()=>{
    fila.ofertasIds=['salud.psicologia'];
    await servicio.guardar('E',guardarPerfilEmpresaSchema.parse({etiquetasCapacidades:[]}));
    expect((await servicio.obtener('E')).etiquetasCapacidades).toEqual([]);
    expect(fila.ofertasIds).toEqual(['salud.psicologia']);
    expect(fila.palabrasClave).toEqual(['informatica']);
  });
  it('valida el rango completo después de una actualización parcial',async()=>{
    fila.montoMaximo='100';
    await expect(servicio.guardar('E',guardarPerfilEmpresaSchema.parse({montoMinimo:101}))).rejects.toThrow('monto máximo');
    expect(repo.save).not.toHaveBeenCalled();
  });
  it('onboarding persiste las hojas y las devuelve en una consulta posterior',async()=>{
    const empresa={id:'E',razonSocial:'Empresa QA',onboardingCompletado:true,onboardingPaso:4,
      creadoEn:new Date(),actualizadoEn:new Date()};
    const membresia={id:'M',empresaId:'E',empresa,rol:'administrador',activa:true};
    const membresias={findOne:vi.fn(async()=>membresia)};
    const manager={query:vi.fn(async()=>[]),getRepository:(clase:unknown)=>clase===PerfilEmpresa?repo:clase===MembresiaEmpresa?membresias:{save:vi.fn()}};
    const ds={getRepository:manager.getRepository,transaction:async(fn:(m:unknown)=>unknown)=>fn(manager)} as unknown as DataSource;
    const onboarding=new OnboardingService(ds,{obtener:vi.fn(async()=>({plan:'individual'}))} as unknown as PlanesEmpresaService);
    const datos=guardarEtiquetasCapacidadesSchema.parse({ofertasIds:['salud.psicologia','salud.lentes'],etiquetasCapacidades:['Salud mental','ISO 9001']});
    const a=await onboarding.guardarEtiquetas('U',datos);
    const b=await onboarding.obtenerEstado('U');
    expect(a.perfil?.ofertasIds).toEqual(['salud.psicologia','salud.lentes']);
    expect(b.perfil?.etiquetasCapacidades).toEqual(['Salud mental','ISO 9001']);
    expect(b.perfil?.palabrasClave).toEqual(['informatica']);expect(b.pasoSiguiente).toBe('dashboard');
  });
  it('permite ofertas sin etiquetas adicionales y conserva la exigencia del modo anterior',()=>{
    expect(guardarEtiquetasCapacidadesSchema.parse({ofertasIds:['salud.psicologia'],etiquetasCapacidades:[]}).etiquetasCapacidades).toEqual([]);
    expect(guardarEtiquetasCapacidadesSchema.safeParse({ofertasIds:[],etiquetasCapacidades:['Salud mental']}).success).toBe(false);
    vi.stubEnv('NEXUS_REDUCIDO_HABILITADO','false');
    expect(guardarEtiquetasCapacidadesSchema.safeParse({etiquetasCapacidades:[]}).success).toBe(false);
  });
});
