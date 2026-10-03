-- ==================================================================
-- 003 · API
-- Vistas publicas, funciones de negocio y difusion en tiempo real.
--
-- Las funciones son SECURITY DEFINER porque las policies de 002
-- quitan la escritura directa al cliente. Aqui es donde viven las
-- reglas de la subasta: monto base, incremento del 10% y ventana de
-- tiempo. El frontend nunca decide si una oferta es valida.
-- ==================================================================

-- ------------------------------------------------------------------
-- Vistas
-- security_invoker = true hace que la consulta se ejecute con los
-- permisos de quien pregunta, de modo que RLS se sigue aplicando.
-- ------------------------------------------------------------------

-- Catalogo publico: una fila por vehiculo, con foto de portada.
CREATE OR REPLACE VIEW public.vw_inventario
WITH (security_invoker = true) AS
SELECT
  v.id,
  v.anio,
  v.tipo_articulo,
  v.marca,
  v.modelo,
  v.motor,
  v.transmision,
  v.combustible,
  v.tren_manejo,
  v.num_cilindros,
  v.nivel_dano,
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

COMMENT ON VIEW public.vw_inventario IS
  'Catalogo publico de subastas activas. No expone la identidad de los postores.';

-- Detalle: una fila por vehiculo con la galeria completa en un array JSON.
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

COMMENT ON VIEW public.vw_vehiculos IS
  'Detalle de vehiculo con galeria. Cubre tambien las publicaciones propias en borrador.';

-- Valores disponibles para construir los filtros del catalogo.
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
     FROM (SELECT DISTINCT btrim(tipo_articulo) AS m
             FROM public.vehiculos WHERE estado = 'activo') t
    WHERE m <> '') AS tipos,
  (SELECT coalesce(jsonb_agg(m ORDER BY m), '[]'::jsonb)
     FROM (SELECT DISTINCT btrim(combustible) AS m
             FROM public.vehiculos WHERE estado = 'activo') t
    WHERE m <> '') AS combustibles,
  (SELECT coalesce(jsonb_agg(m ORDER BY m), '[]'::jsonb)
     FROM (SELECT DISTINCT btrim(transmision) AS m
             FROM public.vehiculos WHERE estado = 'activo') t
    WHERE m <> '') AS transmisiones,
  (SELECT coalesce(jsonb_agg(m ORDER BY m), '[]'::jsonb)
     FROM (SELECT DISTINCT tren_manejo AS m
             FROM public.vehiculos WHERE estado = 'activo' AND tren_manejo <> '') t
    WHERE m <> '') AS trenes,
  (SELECT coalesce(jsonb_agg(m ORDER BY m), '[]'::jsonb)
     FROM (SELECT DISTINCT nivel_dano AS m
             FROM public.vehiculos WHERE estado = 'activo') t) AS danios,
  (SELECT coalesce(jsonb_agg(m ORDER BY m), '[]'::jsonb)
     FROM (SELECT DISTINCT num_cilindros AS m
             FROM public.vehiculos WHERE estado = 'activo') t) AS cilindros,
  (SELECT min(anio) FROM public.vehiculos WHERE estado = 'activo') AS anio_min,
  (SELECT max(anio) FROM public.vehiculos WHERE estado = 'activo') AS anio_max;

-- ------------------------------------------------------------------
-- Funciones de negocio
-- ------------------------------------------------------------------

-- Estado de una subasta concreta, incluido el estado personal del
-- usuario que pregunta. Nunca revela quien es el mejor postor.
CREATE OR REPLACE FUNCTION public.fn_estado_subasta(p_vehiculo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_veh    public.vehiculos%ROWTYPE;
  v_mia    numeric;
BEGIN
  SELECT * INTO v_veh FROM public.vehiculos WHERE id = p_vehiculo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El vehiculo no existe.' USING ERRCODE = 'P0002';
  END IF;

  SELECT p.monto INTO v_mia
    FROM public.pujas p
   WHERE p.vehiculo_id = p_vehiculo_id
     AND p.user_id = v_uid
   ORDER BY p.creado_en DESC
   LIMIT 1;

  RETURN jsonb_build_object(
    'vehiculo_id',    v_veh.id,
    'estado',         public.fn_texto_estado(
                        v_veh.estado, v_veh.fecha_inicio, v_veh.fecha_cierre,
                        v_veh.monto_actual, v_veh.monto_base, v_veh.total_pujas),
    'monto_base',     v_veh.monto_base,
    'monto_actual',   v_veh.monto_actual,
    'total_pujas',    v_veh.total_pujas,
    'monto_minimo',   public.fn_monto_minimo(v_veh.monto_base, v_veh.monto_actual),
    'fecha_inicio',   v_veh.fecha_inicio,
    'fecha_cierre',   v_veh.fecha_cierre,
    'mi_oferta',      v_mia,
    'soy_ganador',    (v_mia IS NOT NULL
                       AND v_veh.total_pujas > 0
                       AND v_mia = v_veh.monto_actual)
  );
END;
$$;

COMMENT ON FUNCTION public.fn_estado_subasta(uuid) IS
  'Estado de la subasta y resultado personal del usuario que consulta.';

-- Ofertar. Toda la validacion ocurre aqui, no en el cliente:
--   1. Sesion iniciada
--   2. El vehiculo existe y esta activo
--   3. No es una subasta propia
--   4. Estas dentro de la ventana de tiempo
--   5. El monto alcanza el minimo (base, o actual + 10%)
CREATE OR REPLACE FUNCTION public.fn_registrar_puja(
  p_vehiculo_id uuid,
  p_monto       numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_veh     public.vehiculos%ROWTYPE;
  v_minimo  numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesion para ofertar.'
      USING ERRCODE = '42501';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto de la oferta debe ser mayor a cero.';
  END IF;

  -- Bloquea la fila: dos pujas simultaneas se serializan aqui en vez
  -- de competitively leer el mismo monto_actual.
  SELECT * INTO v_veh
    FROM public.vehiculos
   WHERE id = p_vehiculo_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El vehiculo no existe.' USING ERRCODE = 'P0002';
  END IF;

  IF v_veh.user_id = v_uid THEN
    RAISE EXCEPTION 'No puedes ofertar en una subasta publicada por ti.';
  END IF;

  IF v_veh.estado <> 'activo' THEN
    RAISE EXCEPTION 'Esta publicacion todavia no esta activa.';
  END IF;

  IF now() < v_veh.fecha_inicio THEN
    RAISE EXCEPTION 'La subasta aun no ha comenzado.';
  END IF;

  IF now() >= v_veh.fecha_cierre THEN
    RAISE EXCEPTION 'Oferta cerrada: la subasta termino.';
  END IF;

  v_minimo := public.fn_monto_minimo(v_veh.monto_base, v_veh.monto_actual);

  IF p_monto < v_minimo THEN
    RAISE EXCEPTION 'Oferta rechazada: el minimo es Q. %.', v_minimo::bigint;
  END IF;

  INSERT INTO public.pujas (vehiculo_id, user_id, monto)
  VALUES (p_vehiculo_id, v_uid, p_monto);

  -- El trigger trg_reflejar_puja ya actualizo la fila.
  RETURN jsonb_build_object(
    'ok',           true,
    'vehiculo_id',  p_vehiculo_id,
    'monto_actual', p_monto,
    'total_pujas',  v_veh.total_pujas + 1,
    'monto_minimo', public.fn_monto_minimo(v_veh.monto_base, p_monto),
    'soy_ganador',  true,
    'estado',       'activa'
  );
END;
$$;

-- Crear la publicacion en estado borrador. Las fotos se suben
-- despues, porque necesitan el id del vehiculo para armar la ruta.
CREATE OR REPLACE FUNCTION public.fn_publicar_vehiculo(p_datos jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesion para publicar un vehiculo.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid) THEN
    RAISE EXCEPTION 'No se encontro tu perfil de usuario.';
  END IF;

  INSERT INTO public.vehiculos (
    user_id, anio, tipo_articulo, marca, modelo, motor, transmision,
    combustible, tren_manejo, num_cilindros, nivel_dano, descripcion,
    monto_base, fecha_inicio, fecha_cierre, estado
  )
  VALUES (
    v_uid,
    (p_datos ->> 'anio')::integer,
    btrim(p_datos ->> 'tipo_articulo'),
    upper(btrim(p_datos ->> 'marca')),
    upper(btrim(p_datos ->> 'modelo')),
    btrim(p_datos ->> 'motor'),
    btrim(p_datos ->> 'transmision'),
    btrim(p_datos ->> 'combustible'),
    upper(btrim(p_datos ->> 'tren_manejo')),
    (p_datos ->> 'num_cilindros')::integer,
    lower(btrim(p_datos ->> 'nivel_dano')),
    nullif(btrim(p_datos ->> 'descripcion'), ''),
    (p_datos ->> 'monto_base')::numeric,
    (p_datos ->> 'fecha_inicio')::timestamptz,
    (p_datos ->> 'fecha_cierre')::timestamptz,
    'borrador'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Publicar de verdad: valida el minimo de 5 fotos antes de exponer el
-- vehiculo en el catalogo.
CREATE OR REPLACE FUNCTION public.fn_activar_vehiculo(p_vehiculo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_veh    public.vehiculos%ROWTYPE;
  v_fotos  integer;
BEGIN
  SELECT * INTO v_veh FROM public.vehiculos WHERE id = p_vehiculo_id FOR UPDATE;

  IF NOT FOUND OR v_veh.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'No puedes publicar este vehiculo.' USING ERRCODE = '42501';
  END IF;

  IF v_veh.fecha_cierre <= now() THEN
    RAISE EXCEPTION 'La fecha de cierre debe ser futura.';
  END IF;

  SELECT count(*)::integer INTO v_fotos
    FROM public.fotos_vehiculo
   WHERE vehiculo_id = p_vehiculo_id;

  IF v_fotos < 5 THEN
    RAISE EXCEPTION 'Se requieren al menos 5 fotografias. Llevas %.', v_fotos;
  END IF;

  UPDATE public.vehiculos SET estado = 'activo' WHERE id = p_vehiculo_id;
END;
$$;

-- Editar una publicacion propia.
CREATE OR REPLACE FUNCTION public.fn_actualizar_vehiculo(
  p_vehiculo_id uuid,
  p_datos        jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_veh     public.vehiculos%ROWTYPE;
  v_fotos   integer;
BEGIN
  SELECT * INTO v_veh FROM public.vehiculos WHERE id = p_vehiculo_id FOR UPDATE;

  IF NOT FOUND OR v_veh.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'No puedes editar este vehiculo.' USING ERRCODE = '42501';
  END IF;

  IF now() >= v_veh.fecha_cierre THEN
    RAISE EXCEPTION 'La subasta ya cerro y no se puede editar.';
  END IF;

  -- Los parametros economicos se congelan cuando ya hay pujas.
  IF v_veh.total_pujas > 0
     AND ((p_datos ->> 'monto_base')::numeric IS DISTINCT FROM v_veh.monto_base
       OR (p_datos ->> 'fecha_inicio')::timestamptz IS DISTINCT FROM v_veh.fecha_inicio
       OR (p_datos ->> 'fecha_cierre')::timestamptz IS DISTINCT FROM v_veh.fecha_cierre) THEN
    RAISE EXCEPTION 'No se puede cambiar el monto base ni las fechas si ya hay pujas.';
  END IF;

  UPDATE public.vehiculos
     SET anio             = (p_datos ->> 'anio')::integer,
         tipo_articulo    = btrim(p_datos ->> 'tipo_articulo'),
         marca            = upper(btrim(p_datos ->> 'marca')),
         modelo           = upper(btrim(p_datos ->> 'modelo')),
         motor            = btrim(p_datos ->> 'motor'),
         transmision      = btrim(p_datos ->> 'transmision'),
         combustible      = btrim(p_datos ->> 'combustible'),
         tren_manejo      = upper(btrim(p_datos ->> 'tren_manejo')),
         num_cilindros    = (p_datos ->> 'num_cilindros')::integer,
         nivel_dano       = lower(btrim(p_datos ->> 'nivel_dano')),
         descripcion      = nullif(btrim(p_datos ->> 'descripcion'), ''),
         monto_base       = coalesce((p_datos ->> 'monto_base')::numeric, v_veh.monto_base),
         fecha_inicio     = coalesce((p_datos ->> 'fecha_inicio')::timestamptz, v_veh.fecha_inicio),
         fecha_cierre     = coalesce((p_datos ->> 'fecha_cierre')::timestamptz, v_veh.fecha_cierre)
   WHERE id = p_vehiculo_id;

  -- Si sigue activa, se revalida el minimo de fotos por si se borraron.
  IF v_veh.estado = 'activo' THEN
    SELECT count(*)::integer INTO v_fotos
      FROM public.fotos_vehiculo
     WHERE vehiculo_id = p_vehiculo_id;

    IF v_fotos < 5 THEN
      RAISE EXCEPTION 'Un vehiculo activo necesita al menos 5 fotografias. Llevas %.', v_fotos;
    END IF;
  END IF;
END;
$$;

-- Eliminar una publicacion propia. Las fotos y pujas caen en cascada.
CREATE OR REPLACE FUNCTION public.fn_eliminar_vehiculo(p_vehiculo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.vehiculos
   WHERE id = p_vehiculo_id
     AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No puedes eliminar este vehiculo.' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_actualizar_perfil(
  p_nombre    text,
  p_apellido  text,
  p_telefono  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesion.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
     SET nombre = btrim(p_nombre),
         apellido = btrim(p_apellido),
         telefono = btrim(p_telefono)
   WHERE id = auth.uid();
END;
$$;

-- ------------------------------------------------------------------
-- Difusion en tiempo real
--
-- Se dispara cuando cambia la oferta mas alta. El payload NO lleva
-- user_id: los clientes deducen si van ganando comparando el monto
-- recibido contra su propia ultima oferta. Asi el anonimato se
-- mantiene de punta a punta.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_trg_diffundir_puja()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF EXISTS (
      SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'realtime'
         AND p.proname = 'send'
    ) THEN
      PERFORM realtime.send(
        jsonb_build_object(
          'vehiculo_id',  NEW.id,
          'monto_actual', NEW.monto_actual,
          'total_pujas',  NEW.total_pujas,
          'monto_base',   NEW.monto_base,
          'estado',       public.fn_texto_estado(
                            NEW.estado, NEW.fecha_inicio, NEW.fecha_cierre,
                            NEW.monto_actual, NEW.monto_base, NEW.total_pujas)
        ),
        'subasta',
        'subasta:' || NEW.id::text,
        false
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Nunca hacemos fallar una puja valida por un problema de difusion.
    RAISE WARNING 'No se pudo difundir la puja por realtime: %', SQLERRM;
  END;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_diffundir_puja ON public.vehiculos;
CREATE TRIGGER trg_diffundir_puja
AFTER UPDATE ON public.vehiculos
FOR EACH ROW
WHEN (OLD.monto_actual IS DISTINCT FROM NEW.monto_actual)
EXECUTE FUNCTION public.fn_trg_diffundir_puja();

-- ------------------------------------------------------------------
-- Permisos de ejecucion
-- ------------------------------------------------------------------

-- El anonimo puede ver el estado de una subasta, pero no ofertar.
GRANT EXECUTE ON FUNCTION public.fn_estado_subasta(uuid) TO anon, authenticated;

-- Operaciones que exigen sesion iniciada.
GRANT EXECUTE ON FUNCTION public.fn_registrar_puja(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_publicar_vehiculo(jsonb)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_activar_vehiculo(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_actualizar_vehiculo(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_eliminar_vehiculo(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_actualizar_perfil(text, text, text) TO authenticated;

-- La lectura de datos pasa por las vistas, no por las tablas.
GRANT SELECT ON public.vw_inventario, public.vw_vehiculos, public.vw_catalogos
  TO anon, authenticated;