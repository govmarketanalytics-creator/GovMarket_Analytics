-- GOVMARKET ANALYTICS / EVIDENCIA ACADEMICA
-- Fragmentos procedentes de un pg_dump estructural del 27-11-2026.
-- ATENCION: NO EJECUTAR sobre una base existente. No es instalador autónomo.
-- Para reproducción completa utilizar B01/23_Esquema_Completo_Solo_Estructura.sql en una BD NUEVA y aislada.

CREATE TABLE public.usuarios (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(254) NOT NULL,
    password_hash character varying(255),
    nombres character varying(120) NOT NULL,
    apellido_paterno character varying(80) NOT NULL,
    apellido_materno character varying(80),
    correo_verificado boolean DEFAULT false NOT NULL,
    es_superadministrador boolean DEFAULT false NOT NULL,
    estado public.estado_usuario_enum DEFAULT 'activo'::public.estado_usuario_enum NOT NULL,
    ultimo_acceso_en timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    google_sub character varying(255),
    CONSTRAINT "CHK_usuarios_metodo_autenticacion" CHECK (((password_hash IS NOT NULL) OR (google_sub IS NOT NULL)))
);

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY (id);


CREATE TABLE public.empresas (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    rut character varying(12) NOT NULL,
    razon_social character varying(200) NOT NULL,
    nombre_fantasia character varying(200),
    estado public.estado_empresa_enum DEFAULT 'activa'::public.estado_empresa_enum NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    descripcion text,
    sitio_web character varying(255),
    region_principal character varying(120),
    comuna character varying(120),
    tamanio_empresa character varying(20),
    anio_fundacion smallint,
    correo_contacto character varying(254),
    telefono_contacto character varying(30),
    onboarding_paso smallint DEFAULT 1 NOT NULL,
    onboarding_completado boolean DEFAULT false NOT NULL,
    onboarding_completado_en timestamp with time zone,
    CONSTRAINT "CHK_empresas_anio_fundacion" CHECK (((anio_fundacion IS NULL) OR ((anio_fundacion >= 1800) AND (anio_fundacion <= 2100)))),
    CONSTRAINT "CHK_empresas_onboarding_paso" CHECK (((onboarding_paso >= 1) AND (onboarding_paso <= 4))),
    CONSTRAINT "CHK_empresas_tamanio" CHECK (((tamanio_empresa IS NULL) OR ((tamanio_empresa)::text = ANY ((ARRAY['micro'::character varying, 'pequena'::character varying, 'mediana'::character varying, 'grande'::character varying])::text[]))))
);

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT "PK_ce7b122b37c6499bfd6520873e1" PRIMARY KEY (id);


CREATE TABLE public.membresias_empresa (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    empresa_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    rol public.rol_membresia_empresa_enum NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.membresias_empresa
    ADD CONSTRAINT "PK_2ecf10c117780cb9c30b7b68656" PRIMARY KEY (id);
ALTER TABLE ONLY public.membresias_empresa
    ADD CONSTRAINT "FK_membresias_empresa_empresa" FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.membresias_empresa
    ADD CONSTRAINT "FK_membresias_empresa_usuario" FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

CREATE TABLE public.perfiles_empresa (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    empresa_id uuid NOT NULL,
    palabras_clave text[] DEFAULT '{}'::text[] NOT NULL,
    codigos_categoria text[] DEFAULT '{}'::text[] NOT NULL,
    regiones text[] DEFAULT '{}'::text[] NOT NULL,
    monto_minimo numeric(18,2),
    monto_maximo numeric(18,2),
    incluir_sin_monto boolean DEFAULT true NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    puntaje_minimo_alerta numeric(5,2) DEFAULT '60'::numeric NOT NULL,
    etiquetas_capacidades text[] DEFAULT '{}'::text[] NOT NULL,
    tipos_oportunidad text[] DEFAULT '{}'::text[] NOT NULL,
    frecuencia_alertas character varying(20),
    ofertas_ids text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT "CHK_perfiles_empresa_frecuencia_alertas" CHECK (((frecuencia_alertas IS NULL) OR ((frecuencia_alertas)::text = ANY ((ARRAY['tiempo_real'::character varying, 'diaria'::character varying, 'semanal'::character varying])::text[])))),
    CONSTRAINT "CHK_perfiles_empresa_monto_maximo" CHECK (((monto_maximo IS NULL) OR (monto_maximo >= (0)::numeric))),
    CONSTRAINT "CHK_perfiles_empresa_monto_minimo" CHECK (((monto_minimo IS NULL) OR (monto_minimo >= (0)::numeric))),
    CONSTRAINT "CHK_perfiles_empresa_puntaje_alerta" CHECK (((puntaje_minimo_alerta >= (0)::numeric) AND (puntaje_minimo_alerta <= (100)::numeric))),
    CONSTRAINT "CHK_perfiles_empresa_rango_montos" CHECK (((monto_minimo IS NULL) OR (monto_maximo IS NULL) OR (monto_minimo <= monto_maximo))),
    CONSTRAINT "CHK_perfiles_empresa_tipos_oportunidad" CHECK ((tipos_oportunidad <@ ARRAY['licitacion_publica'::text, 'trato_directo'::text, 'convenio_marco'::text, 'compra_agil'::text]))
);

ALTER TABLE ONLY public.perfiles_empresa
    ADD CONSTRAINT "PK_8abc03e48ab06548f7731bb3e44" PRIMARY KEY (id);
ALTER TABLE ONLY public.perfiles_empresa
    ADD CONSTRAINT "FK_perfiles_empresa_empresa" FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

