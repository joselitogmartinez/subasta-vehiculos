-- ==================================================================
-- 006 · Ruta de almacenamiento en la galeria
--
-- Para quitar una foto hay que borrar dos cosas: la fila de
-- fotos_vehiculo y el archivo real del bucket. La vista solo devolvia
-- la URL publica, que no sirve para borrar.
--
-- Se agrega `path` (la ruta dentro del bucket) al array de fotos.
-- No es nueva exposicion: el bucket es publico, las URLs ya se envian
-- completas, y la ruta se deduce de {user_id}/{vehiculo_id}/archivo.
-- ==================================================================

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
               jsonb_build_object(
                 'id', f.id,
                 'url', f.url,
                 'path', f.storage_path,
                 'orden', f.orden
               )
               ORDER BY f.orden, f.creado_en
             )
        FROM public.fotos_vehiculo f
       WHERE f.vehiculo_id = v.id
    ),
    '[]'::jsonb
  ) AS fotos,
  (v.user_id = auth.uid()) AS es_mio
FROM public.vehiculos v;

GRANT SELECT ON public.vw_vehiculos TO anon, authenticated;