-- GOVMARKET ANALYTICS / EVIDENCIA ACADEMICA
-- Fragmentos procedentes de un pg_dump estructural del 27-11-2026.
-- ATENCION: NO EJECUTAR sobre una base existente. No es instalador autónomo.
-- Para reproducción completa utilizar B01/23_Esquema_Completo_Solo_Estructura.sql en una BD NUEVA y aislada.

ALTER TABLE ONLY public.alertas_oportunidades
    ADD CONSTRAINT "FK_alertas_oportunidades_licitacion" FOREIGN KEY (licitacion_id) REFERENCES public.licitaciones(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.licitacion_adjudicaciones
    ADD CONSTRAINT "FK_licitacion_adjudicaciones_resultado" FOREIGN KEY (resultado_id) REFERENCES public.licitacion_resultados(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.licitacion_items
    ADD CONSTRAINT "FK_licitacion_items_licitacion" FOREIGN KEY (licitacion_id) REFERENCES public.licitaciones(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.licitacion_resultados
    ADD CONSTRAINT "FK_licitacion_resultados_licitacion" FOREIGN KEY (licitacion_id) REFERENCES public.licitaciones(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.licitaciones_favoritas
    ADD CONSTRAINT "FK_licitaciones_favoritas_empresa" FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.licitaciones_favoritas
    ADD CONSTRAINT "FK_licitaciones_favoritas_licitacion" FOREIGN KEY (licitacion_id) REFERENCES public.licitaciones(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.licitaciones_favoritas
    ADD CONSTRAINT "FK_licitaciones_favoritas_usuario" FOREIGN KEY (agregada_por_usuario_id) REFERENCES public.usuarios(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.licitaciones_listado_dia
    ADD CONSTRAINT "FK_licitaciones_listado_dia_licitacion" FOREIGN KEY (licitacion_id) REFERENCES public.licitaciones(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.notificaciones_oportunidad
    ADD CONSTRAINT "FK_notificaciones_oportunidad_licitacion" FOREIGN KEY (licitacion_id) REFERENCES public.licitaciones(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.licitaciones_ingesta_control
    ADD CONSTRAINT licitaciones_ingesta_control_licitacion_id_fkey FOREIGN KEY (licitacion_id) REFERENCES public.licitaciones(id) ON DELETE CASCADE;
