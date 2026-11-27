-- GOVMARKET ANALYTICS / EVIDENCIA ACADEMICA
-- Fragmentos procedentes de un pg_dump estructural del 27-11-2026.
-- ATENCION: NO EJECUTAR sobre una base existente. No es instalador autónomo.
-- Para reproducción completa utilizar B01/23_Esquema_Completo_Solo_Estructura.sql en una BD NUEVA y aislada.

CREATE TABLE public.suscripciones_empresa (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    empresa_id uuid NOT NULL,
    plan character varying(20) NOT NULL,
    estado character varying(20) NOT NULL,
    vigente_desde timestamp with time zone NOT NULL,
    vigente_hasta timestamp with time zone NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "CHK_suscripciones_empresa_estado" CHECK (((estado)::text = ANY (ARRAY[('activa'::character varying)::text, ('cancelada'::character varying)::text]))),
    CONSTRAINT "CHK_suscripciones_empresa_plan" CHECK (((plan)::text = ANY (ARRAY[('individual'::character varying)::text, ('empresa'::character varying)::text]))),
    CONSTRAINT "CHK_suscripciones_empresa_vigencia" CHECK ((vigente_hasta > vigente_desde))
);

ALTER TABLE ONLY public.suscripciones_empresa
    ADD CONSTRAINT "PK_897cb074e495fa0f67c83e26f4b" PRIMARY KEY (id);
ALTER TABLE ONLY public.suscripciones_empresa
    ADD CONSTRAINT "FK_suscripciones_empresa_empresa" FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

CREATE TABLE public.pagos_transbank (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    empresa_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    plan character varying(20) NOT NULL,
    buy_order character varying(26) NOT NULL,
    session_id character varying(61) NOT NULL,
    token_ws character varying(128),
    monto integer NOT NULL,
    moneda character varying(3) DEFAULT 'CLP'::character varying NOT NULL,
    estado character varying(20) NOT NULL,
    estado_transbank character varying(40),
    codigo_respuesta integer,
    codigo_autorizacion character varying(40),
    tipo_pago character varying(10),
    numero_cuotas integer,
    ultimos_cuatro_tarjeta character varying(4),
    fecha_transaccion timestamp with time zone,
    motivo_fallo character varying(300),
    autorizado_en timestamp with time zone,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    suscripcion_activada_en timestamp with time zone,
    vigencia_desde_aplicada timestamp with time zone,
    vigencia_hasta_aplicada timestamp with time zone,
    CONSTRAINT "CHK_pagos_transbank_estado" CHECK (((estado)::text = ANY ((ARRAY['iniciada'::character varying, 'confirmando'::character varying, 'autorizada'::character varying, 'rechazada'::character varying, 'anulada'::character varying, 'error'::character varying])::text[]))),
    CONSTRAINT "CHK_pagos_transbank_monto" CHECK ((monto > 0)),
    CONSTRAINT "CHK_pagos_transbank_plan" CHECK (((plan)::text = ANY ((ARRAY['individual'::character varying, 'empresa'::character varying])::text[])))
);

ALTER TABLE ONLY public.pagos_transbank
    ADD CONSTRAINT "PK_pagos_transbank" PRIMARY KEY (id);
ALTER TABLE ONLY public.pagos_transbank
    ADD CONSTRAINT "FK_pagos_transbank_empresa" FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.pagos_transbank
    ADD CONSTRAINT "FK_pagos_transbank_usuario" FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;

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


