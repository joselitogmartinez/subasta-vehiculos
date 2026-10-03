-- ==================================================================
-- 005 · Vista de detalle
--
-- Reemplaza vw_vehiculos por una version que:
--   1. Normaliza los textos igual que vw_inventario, para que el detalle
--      y el catalogo muestren la misma cadena.
--   2. NO expone user_id. No hay ninguna razon para que el navegador
--      reciba identificadores de usuario: la interfaz solo necesita
--      saber si la subasta es del visitante, y eso lo responde el
--      servidor con es_mio.
--   3. Calcula es_mio en el servidor. auth.uid() devuelve NULL para un
--      anonimo, y NULL = NULL es NULL, asi que un visitante sin sesion
--      simplemente obtiene false en lugar de un error.
-- ==================================================================

-- Hay que DROP y no solo REPLACE: esta vista cambia el conjunto y el
-- orden de sus columnas, y CREATE OR REPLACE VIEW no permite quitar
-- columnas. Al dropearla se pierde el GRANT, asi que se reotorga al final.
DROP VIEW IF EXISTS public.vw_vehiculos;

CREATE VIEW public.vw_vehiculos
WITH (security_invoker = true) AS
SELECT
  v.id,
  v.anio,
  upper(btrim(v.tipo_articulo)) AS tipo_articulo,
  upper(btrim(v.marca)) AS marca,
  upper(btrim(v.modelo)) AS modelo,
  upper(btrim(v.motor)) AS motor,
  upper(btrim(v.transmision)) AS transmision,
  upper(btrim(v.combustible)) AS combustible,
  upper(btrim(v.tren_manejo)) AS tren_manejo,
  v.num_cilindros,
  lower(btrim(v.nivel_dano)) AS nivel_dano,
  v.descripcion,
  v.monto_base,
  v.fecha_inicio,
  v.fecha_cierre,
  v.estado,
  v.monto_actual,
  v.total_pujas,
  v.creado_en,
  v.actualizado_en,
  public.fn_texto_estado(
    v.estado, v.fecha_inicio, v.fecha_cierre,
    v.monto_actual, v.monto_base, v.total_pujas
  ) AS estado_calculado,
  public.fn_monto_minimo(v.monto_base, v.monto_actual) AS monto_minimo,
  coalesce(
    (
      SELECT jsonb_agg(
               jsonb_build_object('id', f.id, 'url', f.url, 'orden', f.orden)
               ORDER BY f.orden, f.creado_en
             )
        FROM public.fotos_vehiculo f
       WHERE f.vehiculo_id = v.id
    ),
    '[]'::jsonb
  ) AS fotos,
  (v.user_id = auth.uid()) AS es_mio
FROM public.vehiculos v;

COMMENT ON COLUMN public.vw_vehiculos.es_mio IS
  'true si la publicacion pertenece al usuario que consulta. Sustituye a exponer user_id.';

GRANT SELECT ON public.vw_vehiculos TO anon, authenticated;