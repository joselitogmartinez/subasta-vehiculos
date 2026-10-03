-- ==================================================================
-- 004 · Normalizacion en las vistas
--
-- Problema que corrige: los datos pueden llegar con distinta capitalizacion
-- segun quien los escriba. fn_publicar_vehiculo normaliza marca y modelo a
-- mayusculas, pero el seed y una carga manual por SQL no pasan por ahi.
-- Como vw_catalogos devuelve upper(marca) y el filtro del cliente usa
-- eq(marca, <valor del desplegable>), un vehiculo guardado como
-- "Chevrolet" no era encontrado al filtrar por "CHEVROLET": el desplegable
-- ofrecia una opcion que no devolvia nada.
--
-- La solucion es normalizar tambien en la vista, de modo que lo que el
-- desplegable ofrece y lo que el filtro compara sean siempre el mismo valor,
-- sin importar como se haya escrito el dato en la tabla.
-- ==================================================================

CREATE OR REPLACE VIEW public.vw_inventario
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
  v.monto_base,
  v.monto_actual,
  v.total_pujas,
  v.fecha_inicio,
  v.fecha_cierre,
  v.creado_en,
  public.fn_texto_estado(
    v.estado, v.fecha_inicio, v.fecha_cierre,
    v.monto_actual, v.monto_base, v.total_pujas
  ) AS estado_calculado,
  public.fn_monto_minimo(v.monto_base, v.monto_actual) AS monto_minimo,
  (
    SELECT f.url
      FROM public.fotos_vehiculo f
     WHERE f.vehiculo_id = v.id
     ORDER BY f.orden, f.creado_en
     LIMIT 1
  ) AS foto_portada,
  (
    SELECT count(*)::int
      FROM public.fotos_vehiculo f
     WHERE f.vehiculo_id = v.id
  ) AS total_fotos
FROM public.vehiculos v
WHERE v.estado = 'activo';

CREATE OR REPLACE VIEW public.vw_vehiculos
WITH (security_invoker = true) AS
SELECT
  v.*,
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
  ) AS fotos
FROM public.vehiculos v;

-- Los catalogos deben ofrecer exactamente las mismas cadenas que ahora
-- exponen las vistas, y con la misma capitalizacion.
CREATE OR REPLACE VIEW public.vw_catalogos
WITH (security_invoker = true) AS
SELECT
  (SELECT coalesce(jsonb_agg(m ORDER BY m), '[]'::jsonb)
     FROM (SELECT DISTINCT upper(btrim(marca)) AS m
             FROM public.vehiculos WHERE estado = 'activo') t
    WHERE m <> '') AS marcas,
  (SELECT coalesce(jsonb_agg(m ORDER BY m), '[]'::jsonb)
     FROM (SELECT DISTINCT upper(btrim(modelo)) AS m
             FROM public.vehiculos WHERE estado = 'activo') t
    WHERE m <> '') AS modelos,
  (SELECT coalesce(jsonb_agg(m ORDER BY m), '[]'::jsonb)
     FROM (SELECT DISTINCT upper(btrim(tipo_articulo)) AS m
             FROM public.vehiculos WHERE estado = 'activo') t
    WHERE m <> '') AS tipos,
  (SELECT coalesce(jsonb_agg(m ORDER BY m), '[]'::jsonb)
     FROM (SELECT DISTINCT upper(btrim(combustible)) AS m
             FROM public.vehiculos WHERE estado = 'activo') t
    WHERE m <> '') AS combustibles,
  (SELECT coalesce(jsonb_agg(m ORDER BY m), '[]'::jsonb)
     FROM (SELECT DISTINCT upper(btrim(transmision)) AS m
             FROM public.vehiculos WHERE estado = 'activo') t
    WHERE m <> '') AS transmisiones,
  (SELECT coalesce(jsonb_agg(m ORDER BY m), '[]'::jsonb)
     FROM (SELECT DISTINCT upper(btrim(tren_manejo)) AS m
             FROM public.vehiculos WHERE estado = 'activo' AND btrim(tren_manejo) <> '') t
    WHERE m <> '') AS trenes,
  (SELECT coalesce(jsonb_agg(m ORDER BY m), '[]'::jsonb)
     FROM (SELECT DISTINCT lower(btrim(nivel_dano)) AS m
             FROM public.vehiculos WHERE estado = 'activo') t) AS danios,
  (SELECT coalesce(jsonb_agg(m ORDER BY m), '[]'::jsonb)
     FROM (SELECT DISTINCT num_cilindros AS m
             FROM public.vehiculos WHERE estado = 'activo') t) AS cilindros,
  (SELECT min(anio) FROM public.vehiculos WHERE estado = 'activo') AS anio_min,
  (SELECT max(anio) FROM public.vehiculos WHERE estado = 'activo') AS anio_max;