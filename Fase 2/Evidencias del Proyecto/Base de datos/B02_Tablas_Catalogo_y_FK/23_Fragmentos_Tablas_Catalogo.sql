-- GOVMARKET ANALYTICS / EVIDENCIA ACADEMICA
-- Fragmentos procedentes de un pg_dump estructural del 27-11-2026.
-- ATENCION: NO EJECUTAR sobre una base existente. No es instalador autónomo.
-- Para reproducción completa utilizar B01/23_Esquema_Completo_Solo_Estructura.sql en una BD NUEVA y aislada.

CREATE TABLE public.licitaciones (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    codigo_externo character varying(50) NOT NULL,
    nombre character varying(500) NOT NULL,
    descripcion text,
    codigo_estado integer NOT NULL,
    estado character varying(100) NOT NULL,
    codigo_tipo character varying(20),
    tipo character varying(250),
    moneda character varying(10),
    monto_estimado numeric(18,2),
    fecha_publicacion timestamp with time zone,
    fecha_cierre timestamp with time zone,
    fecha_adjudicacion timestamp with time zone,
    codigo_organismo character varying(50),
    nombre_organismo character varying(300),
    codigo_unidad character varying(50),
    nombre_unidad character varying(300),
    comuna_unidad character varying(120),
    region_unidad character varying(120),
    cantidad_reclamos integer,
    datos_origen jsonb NOT NULL,
    sincronizado_en timestamp with time zone DEFAULT now() NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    activa_en_listado boolean DEFAULT false NOT NULL,
    visto_activo_en timestamp with time zone,
    detalle_sincronizado_en timestamp with time zone
);

ALTER TABLE ONLY public.licitaciones
    ADD CONSTRAINT "PK_378bbe0c37e96cf8297fb0efa68" PRIMARY KEY (id);


CREATE TABLE public.licitacion_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    licitacion_id uuid NOT NULL,
    correlativo integer NOT NULL,
    codigo_producto character varying(100),
    codigo_categoria character varying(100),
    categoria character varying(500),
    nombre_producto character varying(500),
    descripcion text,
    unidad_medida character varying(100),
    cantidad numeric(18,4)
);

ALTER TABLE ONLY public.licitacion_items
    ADD CONSTRAINT "PK_917452084169282e08d2a8e62c4" PRIMARY KEY (id);
ALTER TABLE ONLY public.licitacion_items
    ADD CONSTRAINT "FK_licitacion_items_licitacion" FOREIGN KEY (licitacion_id) REFERENCES public.licitaciones(id) ON DELETE CASCADE;

CREATE TABLE public.licitacion_resultados (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    licitacion_id uuid NOT NULL,
    clasificacion character varying(30) NOT NULL,
    motivo text,
    fuente_motivo character varying(100),
    numero_oferentes integer,
    monto_total_adjudicado numeric(18,2) DEFAULT 0 NOT NULL,
    cantidad_adjudicaciones integer DEFAULT 0 NOT NULL,
    datos_origen jsonb DEFAULT '{}'::jsonb NOT NULL,
    resultado_sincronizado_en timestamp with time zone NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "CHK_licitacion_resultados_clasificacion" CHECK (((clasificacion)::text = ANY ((ARRAY['pendiente'::character varying, 'adjudicada'::character varying, 'desierta'::character varying, 'revocada'::character varying, 'cerrada_sin_resultado'::character varying, 'otro'::character varying])::text[]))),
    CONSTRAINT "CHK_licitacion_resultados_oferentes" CHECK (((numero_oferentes IS NULL) OR (numero_oferentes >= 0)))
);

ALTER TABLE ONLY public.licitacion_resultados
    ADD CONSTRAINT "PK_licitacion_resultados" PRIMARY KEY (id);
ALTER TABLE ONLY public.licitacion_resultados
    ADD CONSTRAINT "FK_licitacion_resultados_licitacion" FOREIGN KEY (licitacion_id) REFERENCES public.licitaciones(id) ON DELETE CASCADE;

CREATE TABLE public.licitacion_adjudicaciones (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    resultado_id uuid NOT NULL,
    item_correlativo integer,
    tipo character varying(100),
    fecha timestamp with time zone,
    numero character varying(100),
    numero_oferentes integer,
    url_acta text,
    nombre_proveedor character varying(300),
    rut_proveedor character varying(30),
    cantidad numeric(18,4),
    monto_unitario numeric(18,2),
    monto_total numeric(18,2),
    datos_origen jsonb DEFAULT '{}'::jsonb NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.licitacion_adjudicaciones
    ADD CONSTRAINT "PK_licitacion_adjudicaciones" PRIMARY KEY (id);
ALTER TABLE ONLY public.licitacion_adjudicaciones
    ADD CONSTRAINT "FK_licitacion_adjudicaciones_resultado" FOREIGN KEY (resultado_id) REFERENCES public.licitacion_resultados(id) ON DELETE CASCADE;

CREATE TABLE public.licitaciones_listado_dia (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    fecha date NOT NULL,
    licitacion_id uuid NOT NULL,
    codigo_estado integer,
    estado character varying(100),
    fecha_cierre timestamp with time zone,
    sincronizado_en timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.licitaciones_listado_dia
    ADD CONSTRAINT "PK_licitaciones_listado_dia" PRIMARY KEY (id);
ALTER TABLE ONLY public.licitaciones_listado_dia
    ADD CONSTRAINT "FK_licitaciones_listado_dia_licitacion" FOREIGN KEY (licitacion_id) REFERENCES public.licitaciones(id) ON DELETE CASCADE;

CREATE TABLE public.licitaciones_ingesta_control (
    licitacion_id uuid NOT NULL,
    creada_en timestamp with time zone DEFAULT now() NOT NULL,
    intentos_fallidos integer DEFAULT 0 NOT NULL,
    proximo_intento_en timestamp with time zone DEFAULT now() NOT NULL,
    ultimo_error character varying(40),
    notificar_al_completar boolean DEFAULT false NOT NULL,
    notificacion_procesada boolean DEFAULT false NOT NULL,
    CONSTRAINT licitaciones_ingesta_control_intentos_fallidos_check CHECK ((intentos_fallidos >= 0))
);

ALTER TABLE ONLY public.licitaciones_ingesta_control
    ADD CONSTRAINT licitaciones_ingesta_control_pkey PRIMARY KEY (licitacion_id);
ALTER TABLE ONLY public.licitaciones_ingesta_control
    ADD CONSTRAINT licitaciones_ingesta_control_licitacion_id_fkey FOREIGN KEY (licitacion_id) REFERENCES public.licitaciones(id) ON DELETE CASCADE;

