import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import { OportunidadesService } from '../oportunidades/oportunidades.service';
import { Licitacion } from '../licitaciones/entities/licitacion.entity';
import type { PerfilesEmpresaService } from '../perfiles-empresa/perfiles-empresa.service';
import type { PlanesEmpresaService } from '../planes-empresa/planes-empresa.service';
import { consultarOportunidadesSchema } from '../oportunidades/dto/consultar-oportunidades.dto';

describe('Servicio de oportunidades con NEXUS activo',()=>{
  let servicio:OportunidadesService;
  let perfil: {ofertasIds:string[];[k:string]:unknown};
  let getMany: ReturnType<typeof vi.fn>;
  let getRawMany: ReturnType<typeof vi.fn>;
  const filtros=()=>consultarOportunidadesSchema.parse({alcance:'recomendadas',puntajeMinimo:1,incluirFiltros:'false'});
  beforeEach(()=>{
    vi.stubEnv('NEXUS_REDUCIDO_HABILITADO','true');
    perfil={id:'P',empresaId:'E',activo:true,ofertasIds:['salud.psicologia'],etiquetasCapacidades:['Salud mental'],
      palabrasClave:['software'],codigosCategoria:['QA-OTRO'],regiones:['Metropolitana'],
      montoMinimo:null,montoMaximo:null,incluirSinMonto:true,tiposOportunidad:[],actualizadoEn:'2026-01-01'};
    const fecha=new Date(Date.now()+86400000);
    getMany=vi.fn(async()=>[
      Object.assign(new Licitacion(),{id:'L1',codigoExterno:'1-1-LE26',nombre:'Psicología',descripcion:null,detalleSincronizadoEn:new Date(),sincronizadoEn:new Date(),fechaCierre:fecha,fechaPublicacion:new Date(),montoEstimado:null,regionUnidad:'Metropolitana',items:[{nombreProducto:'Atención psicológica',correlativo:1}]}),
      Object.assign(new Licitacion(),{id:'L2',codigoExterno:'2-1-LE26',nombre:'Desarrollo de software para hospital',descripcion:null,detalleSincronizadoEn:new Date(),sincronizadoEn:new Date(),fechaCierre:fecha,fechaPublicacion:new Date(),montoEstimado:null,regionUnidad:'Metropolitana',items:[{nombreProducto:'Desarrollo de software',codigoCategoria:'QA-OTRO',correlativo:1}]}),
    ]);
    const q:Record<string,unknown>={};
    for(const n of ['select','addSelect','where','andWhere','leftJoin','leftJoinAndSelect','innerJoin','distinct','orderBy','addOrderBy','offset','limit']) q[n]=()=>q;
    getRawMany=vi.fn(async()=>[{id:'L1'},{id:'L2'}]);
    q.getMany=getMany;q.getRawMany=getRawMany;
    servicio=new OportunidadesService({createQueryBuilder:()=>q,query:async()=>[{revision:'v1',proximo:new Date(Date.now()+60000).toISOString()}]} as unknown as Repository<Licitacion>,
      {obtener:async()=>({...perfil})} as unknown as PerfilesEmpresaService,{} as PlanesEmpresaService);
  });
  afterEach(()=>vi.unstubAllEnvs());
  it('región, categorías heredadas y palabras clave no saltan la comprobación de oferta',async()=>{
    const r=await servicio.listar('E',filtros());
    expect(r.datos.map(x=>x.codigoExterno)).toEqual(['1-1-LE26']);
    expect(r.datos[0].nexus?.estado).toBe('coincidencia');
  });
  it('un cambio de ofertas invalida la caché aun si el catálogo no cambia',async()=>{
    const a=await servicio.listar('E',filtros());expect(a.datos[0].codigoExterno).toBe('1-1-LE26');
    perfil.ofertasIds=['tecnologia.desarrollo-software'];
    const b=await servicio.listar('E',filtros());expect(b.datos.map(x=>x.codigoExterno)).toEqual(['2-1-LE26']);
    expect(getMany).toHaveBeenCalledTimes(2);
  });
  it('fusiona etiquetas y palabras clave sin duplicarlas ni habilitar ofertas ajenas',async()=>{
    perfil.etiquetasCapacidades=['Atención psicológica','Desarrollo de software'];
    perfil.palabrasClave=['ATENCION PSICOLOGICA','software'];
    const r=await servicio.listar('E',filtros());
    expect(r.datos.map(x=>x.codigoExterno)).toEqual(['1-1-LE26']);
    expect(r.datos[0].nexus?.palabrasClaveCoincidentes).toEqual(['atencion psicologica']);
    expect(r.datos[0].nexus?.porcentaje).toBe(100);
    perfil.etiquetasCapacidades=['ISO 9001'];perfil.palabrasClave=[];
    const siguiente=await servicio.listar('E',filtros());
    expect(siguiente.datos[0].nexus?.palabrasClaveCoincidentes).toEqual([]);
    expect(getMany).toHaveBeenCalledTimes(2);
  });
  it('las etiquetas priorizan ofertas pertinentes con el mismo porcentaje',async()=>{
    const filas=await getMany();getMany.mockClear();
    getRawMany.mockResolvedValue([{id:'L1'},{id:'L2'},{id:'L3'}]);
    getMany.mockResolvedValue([...filas,Object.assign(new Licitacion(),{
      ...filas[0],id:'L3',codigoExterno:'3-1-LE26',
      fechaCierre:new Date(Date.now()+7*86400000),
      items:[{nombreProducto:'Atención psicológica modalidad remota',correlativo:1}],
    })]);
    perfil.etiquetasCapacidades=['modalidad remota'];perfil.palabrasClave=[];
    const r=await servicio.listar('E',filtros());
    expect(r.datos.map(x=>x.codigoExterno)).toEqual(['3-1-LE26','1-1-LE26']);
    expect(r.datos[0].nexus?.palabrasClaveCoincidentes).toEqual(['modalidad remota']);
  });
  it('un perfil antiguo exige precisar ofertas y evita cargar todo el catálogo',async()=>{
    perfil.ofertasIds=[];
    const r=await servicio.listar('E',filtros());
    expect(r.datos).toEqual([]);expect(r.perfil?.necesitaOfertasNexus).toBe(true);
    expect(getMany).not.toHaveBeenCalled();
  });
});
