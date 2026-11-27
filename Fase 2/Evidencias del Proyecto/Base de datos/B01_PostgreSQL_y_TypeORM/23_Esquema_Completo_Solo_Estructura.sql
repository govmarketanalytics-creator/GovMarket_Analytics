--
-- PostgreSQL database dump
--

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: estado_empresa_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_empresa_enum AS ENUM (
    'activa',
    'suspendida',
    'inactiva'
);


--
-- Name: estado_usuario_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_usuario_enum AS ENUM (
    'activo',
    'bloqueado',
    'inactivo'
);


--
-- Name: rol_membresia_empresa_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rol_membresia_empresa_enum AS ENUM (
    'administrador',
    'analista_comercial'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alertas_oportunidades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alertas_oportunidades (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    empresa_id uuid NOT NULL,
    licitacion_id uuid NOT NULL,
    porcentaje_compatibilidad numeric(5,2) NOT NULL,
    coincidencias jsonb NOT NULL,
    leida boolean DEFAULT false NOT NULL,
    leida_en timestamp with time zone,
    generada_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizada_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "CHK_alertas_oportunidades_porcentaje" CHECK (((porcentaje_compatibilidad >= (0)::numeric) AND (porcentaje_compatibilidad <= (100)::numeric)))
);


--
-- Name: empresas; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: licitacion_adjudicaciones; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: licitacion_items; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: licitacion_resultados; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: licitaciones; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: licitaciones_favoritas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.licitaciones_favoritas (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    empresa_id uuid NOT NULL,
    licitacion_id uuid NOT NULL,
    agregada_por_usuario_id uuid,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: licitaciones_ingesta_control; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: licitaciones_listado_dia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.licitaciones_listado_dia (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    fecha date NOT NULL,
    licitacion_id uuid NOT NULL,
    codigo_estado integer,
    estado character varying(100),
    fecha_cierre timestamp with time zone,
    sincronizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: membresias_empresa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.membresias_empresa (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    empresa_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    rol public.rol_membresia_empresa_enum NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mercado_publico_solicitudes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mercado_publico_solicitudes (
    id bigint NOT NULL,
    ticket_hash character varying(64) NOT NULL,
    solicitado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mercado_publico_solicitudes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mercado_publico_solicitudes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mercado_publico_solicitudes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mercado_publico_solicitudes_id_seq OWNED BY public.mercado_publico_solicitudes.id;


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: notificaciones_oportunidad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificaciones_oportunidad (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    empresa_id uuid NOT NULL,
    licitacion_id uuid NOT NULL,
    tipo character varying(40) NOT NULL,
    porcentaje_compatibilidad numeric(5,2) NOT NULL,
    es_prueba boolean DEFAULT false NOT NULL,
    creada_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "CHK_notificaciones_oportunidad_porcentaje" CHECK (((porcentaje_compatibilidad >= (0)::numeric) AND (porcentaje_compatibilidad <= (100)::numeric)))
);


--
-- Name: notificaciones_usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificaciones_usuario (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    notificacion_id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    leida boolean DEFAULT false NOT NULL,
    leida_en timestamp with time zone,
    creada_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizada_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pagos_transbank; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: perfiles_empresa; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: sincronizaciones_listado_dia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sincronizaciones_listado_dia (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    fecha date NOT NULL,
    cantidad_informada integer NOT NULL,
    codigos_indexados integer NOT NULL,
    sincronizado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: suscripciones_empresa; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

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


--
-- Name: mercado_publico_solicitudes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mercado_publico_solicitudes ALTER COLUMN id SET DEFAULT nextval('public.mercado_publico_solicitudes_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: membresias_empresa PK_2ecf10c117780cb9c30b7b68656; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membresias_empresa
    ADD CONSTRAINT "PK_2ecf10c117780cb9c30b7b68656" PRIMARY KEY (id);


--
-- Name: licitaciones_favoritas PK_2f2b0b409d2f371c4e187359a0c; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licitaciones_favoritas
    ADD CONSTRAINT "PK_2f2b0b409d2f371c4e187359a0c" PRIMARY KEY (id);


--
-- Name: licitaciones PK_378bbe0c37e96cf8297fb0efa68; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licitaciones
    ADD CONSTRAINT "PK_378bbe0c37e96cf8297fb0efa68" PRIMARY KEY (id);


--
-- Name: suscripciones_empresa PK_897cb074e495fa0f67c83e26f4b; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suscripciones_empresa
    ADD CONSTRAINT "PK_897cb074e495fa0f67c83e26f4b" PRIMARY KEY (id);


--
-- Name: perfiles_empresa PK_8abc03e48ab06548f7731bb3e44; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfiles_empresa
    ADD CONSTRAINT "PK_8abc03e48ab06548f7731bb3e44" PRIMARY KEY (id);


--
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


--
-- Name: licitacion_items PK_917452084169282e08d2a8e62c4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licitacion_items
    ADD CONSTRAINT "PK_917452084169282e08d2a8e62c4" PRIMARY KEY (id);


--
-- Name: alertas_oportunidades PK_b68ef1d279aad6900c7ea31bcf4; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertas_oportunidades
    ADD CONSTRAINT "PK_b68ef1d279aad6900c7ea31bcf4" PRIMARY KEY (id);


--
-- Name: empresas PK_ce7b122b37c6499bfd6520873e1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresas
    ADD CONSTRAINT "PK_ce7b122b37c6499bfd6520873e1" PRIMARY KEY (id);


--
-- Name: usuarios PK_d7281c63c176e152e4c531594a8; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT "PK_d7281c63c176e152e4c531594a8" PRIMARY KEY (id);


--
-- Name: licitacion_adjudicaciones PK_licitacion_adjudicaciones; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licitacion_adjudicaciones
    ADD CONSTRAINT "PK_licitacion_adjudicaciones" PRIMARY KEY (id);


--
-- Name: licitacion_resultados PK_licitacion_resultados; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licitacion_resultados
    ADD CONSTRAINT "PK_licitacion_resultados" PRIMARY KEY (id);


--
-- Name: licitaciones_listado_dia PK_licitaciones_listado_dia; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licitaciones_listado_dia
    ADD CONSTRAINT "PK_licitaciones_listado_dia" PRIMARY KEY (id);


--
-- Name: notificaciones_oportunidad PK_notificaciones_oportunidad; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_oportunidad
    ADD CONSTRAINT "PK_notificaciones_oportunidad" PRIMARY KEY (id);


--
-- Name: notificaciones_usuario PK_notificaciones_usuario; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_usuario
    ADD CONSTRAINT "PK_notificaciones_usuario" PRIMARY KEY (id);


--
-- Name: pagos_transbank PK_pagos_transbank; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_transbank
    ADD CONSTRAINT "PK_pagos_transbank" PRIMARY KEY (id);


--
-- Name: sincronizaciones_listado_dia PK_sincronizaciones_listado_dia; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sincronizaciones_listado_dia
    ADD CONSTRAINT "PK_sincronizaciones_listado_dia" PRIMARY KEY (id);


--
-- Name: licitaciones_ingesta_control licitaciones_ingesta_control_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licitaciones_ingesta_control
    ADD CONSTRAINT licitaciones_ingesta_control_pkey PRIMARY KEY (licitacion_id);


--
-- Name: mercado_publico_solicitudes mercado_publico_solicitudes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mercado_publico_solicitudes
    ADD CONSTRAINT mercado_publico_solicitudes_pkey PRIMARY KEY (id);


--
-- Name: IDX_alertas_oportunidades_empresa_leida; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_alertas_oportunidades_empresa_leida" ON public.alertas_oportunidades USING btree (empresa_id, leida);


--
-- Name: IDX_alertas_oportunidades_licitacion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_alertas_oportunidades_licitacion_id" ON public.alertas_oportunidades USING btree (licitacion_id);


--
-- Name: IDX_ingesta_proximo_intento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_ingesta_proximo_intento" ON public.licitaciones_ingesta_control USING btree (proximo_intento_en, creada_en);


--
-- Name: IDX_licitacion_adjudicaciones_resultado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_licitacion_adjudicaciones_resultado" ON public.licitacion_adjudicaciones USING btree (resultado_id);


--
-- Name: IDX_licitacion_adjudicaciones_rut_proveedor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_licitacion_adjudicaciones_rut_proveedor" ON public.licitacion_adjudicaciones USING btree (rut_proveedor);


--
-- Name: IDX_licitacion_items_codigo_categoria; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_licitacion_items_codigo_categoria" ON public.licitacion_items USING btree (codigo_categoria);


--
-- Name: IDX_licitacion_items_codigo_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_licitacion_items_codigo_producto" ON public.licitacion_items USING btree (codigo_producto);


--
-- Name: IDX_licitacion_items_licitacion_correlativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_licitacion_items_licitacion_correlativo" ON public.licitacion_items USING btree (licitacion_id, correlativo);


--
-- Name: IDX_licitacion_resultados_clasificacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_licitacion_resultados_clasificacion" ON public.licitacion_resultados USING btree (clasificacion);


--
-- Name: IDX_licitacion_resultados_sincronizado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_licitacion_resultados_sincronizado" ON public.licitacion_resultados USING btree (resultado_sincronizado_en);


--
-- Name: IDX_licitaciones_activa_estado_cierre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_licitaciones_activa_estado_cierre" ON public.licitaciones USING btree (activa_en_listado, codigo_estado, fecha_cierre);


--
-- Name: IDX_licitaciones_codigo_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_licitaciones_codigo_estado" ON public.licitaciones USING btree (codigo_estado);


--
-- Name: IDX_licitaciones_codigo_organismo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_licitaciones_codigo_organismo" ON public.licitaciones USING btree (codigo_organismo);


--
-- Name: IDX_licitaciones_detalle_sincronizado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_licitaciones_detalle_sincronizado" ON public.licitaciones USING btree (detalle_sincronizado_en);


--
-- Name: IDX_licitaciones_favoritas_licitacion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_licitaciones_favoritas_licitacion_id" ON public.licitaciones_favoritas USING btree (licitacion_id);


--
-- Name: IDX_licitaciones_favoritas_usuario_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_licitaciones_favoritas_usuario_id" ON public.licitaciones_favoritas USING btree (agregada_por_usuario_id);


--
-- Name: IDX_licitaciones_fecha_cierre; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_licitaciones_fecha_cierre" ON public.licitaciones USING btree (fecha_cierre);


--
-- Name: IDX_licitaciones_fecha_publicacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_licitaciones_fecha_publicacion" ON public.licitaciones USING btree (fecha_publicacion);


--
-- Name: IDX_licitaciones_listado_dia_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_licitaciones_listado_dia_fecha" ON public.licitaciones_listado_dia USING btree (fecha);


--
-- Name: IDX_licitaciones_listado_dia_licitacion; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_licitaciones_listado_dia_licitacion" ON public.licitaciones_listado_dia USING btree (licitacion_id);


--
-- Name: IDX_membresias_empresa_usuario_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_membresias_empresa_usuario_id" ON public.membresias_empresa USING btree (usuario_id);


--
-- Name: IDX_mercado_solicitudes_ticket_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_mercado_solicitudes_ticket_fecha" ON public.mercado_publico_solicitudes USING btree (ticket_hash, solicitado_en);


--
-- Name: IDX_notificaciones_oportunidad_empresa_creada; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_notificaciones_oportunidad_empresa_creada" ON public.notificaciones_oportunidad USING btree (empresa_id, creada_en);


--
-- Name: IDX_notificaciones_usuario_usuario_leida; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_notificaciones_usuario_usuario_leida" ON public.notificaciones_usuario USING btree (usuario_id, leida);


--
-- Name: IDX_pagos_transbank_empresa_creado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_pagos_transbank_empresa_creado" ON public.pagos_transbank USING btree (empresa_id, creado_en);


--
-- Name: IDX_pagos_transbank_suscripcion_activada; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_pagos_transbank_suscripcion_activada" ON public.pagos_transbank USING btree (suscripcion_activada_en);


--
-- Name: UQ_alertas_oportunidades_empresa_licitacion; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_alertas_oportunidades_empresa_licitacion" ON public.alertas_oportunidades USING btree (empresa_id, licitacion_id);


--
-- Name: UQ_empresas_rut; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_empresas_rut" ON public.empresas USING btree (rut);


--
-- Name: UQ_licitacion_resultados_licitacion; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_licitacion_resultados_licitacion" ON public.licitacion_resultados USING btree (licitacion_id);


--
-- Name: UQ_licitaciones_codigo_externo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_licitaciones_codigo_externo" ON public.licitaciones USING btree (codigo_externo);


--
-- Name: UQ_licitaciones_favoritas_empresa_licitacion; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_licitaciones_favoritas_empresa_licitacion" ON public.licitaciones_favoritas USING btree (empresa_id, licitacion_id);


--
-- Name: UQ_licitaciones_listado_dia_fecha_licitacion; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_licitaciones_listado_dia_fecha_licitacion" ON public.licitaciones_listado_dia USING btree (fecha, licitacion_id);


--
-- Name: UQ_membresias_empresa_empresa_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_membresias_empresa_empresa_usuario" ON public.membresias_empresa USING btree (empresa_id, usuario_id);


--
-- Name: UQ_notificaciones_oportunidad_empresa_licitacion_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_notificaciones_oportunidad_empresa_licitacion_tipo" ON public.notificaciones_oportunidad USING btree (empresa_id, licitacion_id, tipo);


--
-- Name: UQ_notificaciones_usuario_notificacion_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_notificaciones_usuario_notificacion_usuario" ON public.notificaciones_usuario USING btree (notificacion_id, usuario_id);


--
-- Name: UQ_pagos_transbank_buy_order; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_pagos_transbank_buy_order" ON public.pagos_transbank USING btree (buy_order);


--
-- Name: UQ_pagos_transbank_token_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_pagos_transbank_token_ws" ON public.pagos_transbank USING btree (token_ws);


--
-- Name: UQ_perfiles_empresa_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_perfiles_empresa_empresa_id" ON public.perfiles_empresa USING btree (empresa_id);


--
-- Name: UQ_sincronizaciones_listado_dia_fecha; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_sincronizaciones_listado_dia_fecha" ON public.sincronizaciones_listado_dia USING btree (fecha);


--
-- Name: UQ_suscripciones_empresa_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_suscripciones_empresa_empresa_id" ON public.suscripciones_empresa USING btree (empresa_id);


--
-- Name: UQ_usuarios_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_usuarios_email" ON public.usuarios USING btree (email);


--
-- Name: UQ_usuarios_google_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "UQ_usuarios_google_sub" ON public.usuarios USING btree (google_sub);


--
-- Name: alertas_oportunidades FK_alertas_oportunidades_empresa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertas_oportunidades
    ADD CONSTRAINT "FK_alertas_oportunidades_empresa" FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: alertas_oportunidades FK_alertas_oportunidades_licitacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertas_oportunidades
    ADD CONSTRAINT "FK_alertas_oportunidades_licitacion" FOREIGN KEY (licitacion_id) REFERENCES public.licitaciones(id) ON DELETE CASCADE;


--
-- Name: licitacion_adjudicaciones FK_licitacion_adjudicaciones_resultado; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licitacion_adjudicaciones
    ADD CONSTRAINT "FK_licitacion_adjudicaciones_resultado" FOREIGN KEY (resultado_id) REFERENCES public.licitacion_resultados(id) ON DELETE CASCADE;


--
-- Name: licitacion_items FK_licitacion_items_licitacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licitacion_items
    ADD CONSTRAINT "FK_licitacion_items_licitacion" FOREIGN KEY (licitacion_id) REFERENCES public.licitaciones(id) ON DELETE CASCADE;


--
-- Name: licitacion_resultados FK_licitacion_resultados_licitacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licitacion_resultados
    ADD CONSTRAINT "FK_licitacion_resultados_licitacion" FOREIGN KEY (licitacion_id) REFERENCES public.licitaciones(id) ON DELETE CASCADE;


--
-- Name: licitaciones_favoritas FK_licitaciones_favoritas_empresa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licitaciones_favoritas
    ADD CONSTRAINT "FK_licitaciones_favoritas_empresa" FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: licitaciones_favoritas FK_licitaciones_favoritas_licitacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licitaciones_favoritas
    ADD CONSTRAINT "FK_licitaciones_favoritas_licitacion" FOREIGN KEY (licitacion_id) REFERENCES public.licitaciones(id) ON DELETE CASCADE;


--
-- Name: licitaciones_favoritas FK_licitaciones_favoritas_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licitaciones_favoritas
    ADD CONSTRAINT "FK_licitaciones_favoritas_usuario" FOREIGN KEY (agregada_por_usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;


--
-- Name: licitaciones_listado_dia FK_licitaciones_listado_dia_licitacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licitaciones_listado_dia
    ADD CONSTRAINT "FK_licitaciones_listado_dia_licitacion" FOREIGN KEY (licitacion_id) REFERENCES public.licitaciones(id) ON DELETE CASCADE;


--
-- Name: membresias_empresa FK_membresias_empresa_empresa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membresias_empresa
    ADD CONSTRAINT "FK_membresias_empresa_empresa" FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: membresias_empresa FK_membresias_empresa_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.membresias_empresa
    ADD CONSTRAINT "FK_membresias_empresa_usuario" FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: notificaciones_oportunidad FK_notificaciones_oportunidad_empresa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_oportunidad
    ADD CONSTRAINT "FK_notificaciones_oportunidad_empresa" FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: notificaciones_oportunidad FK_notificaciones_oportunidad_licitacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_oportunidad
    ADD CONSTRAINT "FK_notificaciones_oportunidad_licitacion" FOREIGN KEY (licitacion_id) REFERENCES public.licitaciones(id) ON DELETE CASCADE;


--
-- Name: notificaciones_usuario FK_notificaciones_usuario_notificacion; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_usuario
    ADD CONSTRAINT "FK_notificaciones_usuario_notificacion" FOREIGN KEY (notificacion_id) REFERENCES public.notificaciones_oportunidad(id) ON DELETE CASCADE;


--
-- Name: notificaciones_usuario FK_notificaciones_usuario_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificaciones_usuario
    ADD CONSTRAINT "FK_notificaciones_usuario_usuario" FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: pagos_transbank FK_pagos_transbank_empresa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_transbank
    ADD CONSTRAINT "FK_pagos_transbank_empresa" FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: pagos_transbank FK_pagos_transbank_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_transbank
    ADD CONSTRAINT "FK_pagos_transbank_usuario" FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: perfiles_empresa FK_perfiles_empresa_empresa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.perfiles_empresa
    ADD CONSTRAINT "FK_perfiles_empresa_empresa" FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: suscripciones_empresa FK_suscripciones_empresa_empresa; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suscripciones_empresa
    ADD CONSTRAINT "FK_suscripciones_empresa_empresa" FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;


--
-- Name: licitaciones_ingesta_control licitaciones_ingesta_control_licitacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licitaciones_ingesta_control
    ADD CONSTRAINT licitaciones_ingesta_control_licitacion_id_fkey FOREIGN KEY (licitacion_id) REFERENCES public.licitaciones(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

