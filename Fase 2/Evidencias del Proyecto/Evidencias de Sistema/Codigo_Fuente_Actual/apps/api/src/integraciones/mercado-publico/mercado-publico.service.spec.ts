import { BadGatewayException, BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MercadoPublicoService } from './mercado-publico.service';
import type { ControlConsultasService } from './control-consultas.service';

const configuracionPrueba: Record<string, string | number> = {
  MERCADO_PUBLICO_API_URL: 'https://api.mercadopublico.cl/servicios/v1/publico',
  MERCADO_PUBLICO_TICKET: 'ticket-falso-para-pruebas',
  MERCADO_PUBLICO_TIMEOUT_MS: 15000,
  MERCADO_PUBLICO_MAX_RETRIES: 3,
  MERCADO_PUBLICO_RETRY_BASE_DELAY_MS: 1,
};

function crearServicio(): MercadoPublicoService {
  const configService = {
    getOrThrow: vi.fn((clave: string) => {
      const valor = configuracionPrueba[clave];

      if (valor === undefined) {
        throw new Error(`Configuración faltante: ${clave}`);
      }

      return valor;
    }),
  } as unknown as ConfigService;

  return new MercadoPublicoService(configService, { reservarSolicitud: vi.fn().mockResolvedValue(undefined) } as unknown as ControlConsultasService);
}

function crearRespuestaApiValida(): Response {
  return new Response(
    JSON.stringify({
      Cantidad: 1,
      FechaCreacion: '2026-09-10T12:00:00',
      Version: 'v1',
      Listado: [
        {
          CodigoExterno: '1234-5-L126',
          Nombre: 'Adquisición de servicios tecnológicos',
          CodigoEstado: 5,
          FechaCierre: '2026-09-20T15:00:00',
        },
      ],
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    },
  );
}

describe('MercadoPublicoService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('consulta las licitaciones del día', async () => {
    const fetchMock = vi.fn().mockResolvedValue(crearRespuestaApiValida());

    vi.stubGlobal('fetch', fetchMock);

    const servicio = crearServicio();
    const respuesta = await servicio.listarLicitacionesDelDia();

    expect(respuesta.Cantidad).toBe(1);
    expect(respuesta.Version).toBe('v1');
    expect(respuesta.Listado[0].CodigoExterno).toBe('1234-5-L126');
    expect(fetchMock).toHaveBeenCalledOnce();

    const url = fetchMock.mock.calls[0][0] as URL;

    expect(url.hostname).toBe('api.mercadopublico.cl');
    expect(url.pathname).toBe('/servicios/v1/publico/licitaciones.json');
    expect(url.searchParams.get('ticket')).toBe('ticket-falso-para-pruebas');
  });

  it('consulta el catálogo completo de licitaciones activas', async () => {
    const fetchMock = vi.fn().mockResolvedValue(crearRespuestaApiValida());

    vi.stubGlobal('fetch', fetchMock);

    const servicio = crearServicio();
    await servicio.listarLicitacionesActivas();

    const url = fetchMock.mock.calls[0][0] as URL;

    expect(url.searchParams.get('estado')).toBe('activas');
    expect(url.searchParams.get('ticket')).toBe('ticket-falso-para-pruebas');
  });

  it('formatea una fecha utilizando la zona horaria de Chile', async () => {
    const fetchMock = vi.fn().mockResolvedValue(crearRespuestaApiValida());

    vi.stubGlobal('fetch', fetchMock);

    const servicio = crearServicio();

    await servicio.listarLicitacionesPorFecha(new Date('2026-09-10T12:00:00Z'));

    const url = fetchMock.mock.calls[0][0] as URL;

    expect(url.searchParams.get('fecha')).toBe('10092026');
  });

  it('reintenta cuando Mercado Público responde HTTP 429', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 429,
          headers: {
            'retry-after': '0',
          },
        }),
      )
      .mockResolvedValueOnce(crearRespuestaApiValida());

    vi.stubGlobal('fetch', fetchMock);

    const servicio = crearServicio();
    const respuesta = await servicio.listarLicitacionesDelDia();

    expect(respuesta.Cantidad).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rechaza un código de licitación inválido', () => {
    const servicio = crearServicio();

    expect(() =>
      servicio.obtenerLicitacionPorCodigo('codigo-invalido'),
    ).toThrow(BadRequestException);
  });

  it('rechaza una estructura de respuesta inesperada', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          mensaje: 'respuesta inválida',
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        },
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    const servicio = crearServicio();

    await expect(servicio.listarLicitacionesDelDia()).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
