-- ==================================================================
-- 002 · Seguridad
-- Row Level Security, permisos y almacenamiento de imagenes.
--
-- Regla general: el cliente NUNCA escribe directo en las tablas de
-- negocio. Toda operacion que afecte una subasta pasa por funciones
-- SECURITY DEFINER (003), que son las unicas que pueden escribir.
-- ==================================================================

ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehiculos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fotos_vehiculo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pujas         ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------
-- profiles
-- Cada usuario ve y edita unicamente su propio perfil. Nadie mas.
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS perfiles_su_propio ON public.profiles;
CREATE POLICY perfiles_su_propio
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS perfiles_actualizar ON public.profiles;
CREATE POLICY perfiles_actualizar
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ------------------------------------------------------------------
-- vehiculos
-- Lectura: anonimos y usuarios ven las subastas activas. Cada
--          propietario ve ademas sus borradores y sus propias
--          publicaciones, para poder editarlas.
-- Escritura: ninguna directa. Todo pasa por las RPCs.
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS vehiculos_leer ON public.vehiculos;
CREATE POLICY vehiculos_leer
  ON public.vehiculos
  FOR SELECT
  TO anon, authenticated
  USING (estado = 'activo' OR user_id = auth.uid());

-- ------------------------------------------------------------------
-- fotos_vehiculo
-- Se pueden ver las fotos de vehiculos activos y las propias.
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS fotos_leer ON public.fotos_vehiculo;
CREATE POLICY fotos_leer
  ON public.fotos_vehiculo
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vehiculos v
      WHERE v.id = vehiculo_id
        AND (v.estado = 'activo' OR v.user_id = auth.uid())
    )
  );

-- Solo el dueno anade fotos de sus propios vehiculos.
DROP POLICY IF EXISTS fotos_agregar ON public.fotos_vehiculo;
CREATE POLICY fotos_agregar
  ON public.fotos_vehiculo
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vehiculos v
      WHERE v.id = vehiculo_id AND v.user_id = auth.uid()
    )
  );

-- Solo el dueno quita fotos de sus propios vehiculos.
DROP POLICY IF EXISTS fotos_borrar ON public.fotos_vehiculo;
CREATE POLICY fotos_borrar
  ON public.fotos_vehiculo
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vehiculos v
      WHERE v.id = vehiculo_id AND v.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------------
-- pujas
-- SIN POLITICA DE LECTURA. No es un olvido: es el requisito de
-- anonimato. La oferta vigente se lee de vehiculos.monto_actual.
-- Tampoco hay politica de INSERT: la puja solo puede hacerse
-- mediante fn_registrar_puja, que valida las reglas de negocio.
-- ------------------------------------------------------------------
-- (intencionalmente vacio)

-- ------------------------------------------------------------------
-- Permisos por defecto
-- ------------------------------------------------------------------

-- El anonimo (navegador sin sesion) y el usuario autenticado solo
-- pueden LEER las tablas que RLS protege. Sin escritura directa.
REVOKE INSERT, UPDATE, DELETE ON public.profiles      FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.vehiculos     FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.fotos_vehiculo FROM anon, authenticated;
REVOKE ALL                         ON public.pujas     FROM anon, authenticated;

-- El rol de servicio (scripts de Node) conserva acceso total.
GRANT ALL ON public.profiles, public.vehiculos, public.fotos_vehiculo, public.pujas TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ------------------------------------------------------------------
-- Storage · bucket publico para las fotos de los vehiculos
-- Estructura de carpetas: {user_id}/{vehiculo_id}/{archivo}
-- ------------------------------------------------------------------
-- Nota: este archivo se ejecuta con el rol `postgres`, que NO es dueno
-- de storage.buckets ni de storage.objects. Por eso se insertan filas y
-- se crean policies, pero no se pueden usar Sentencias COMMENT ON ni
-- ALTER sobre objetos de storage.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehiculos',
  'vehiculos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS vehiculo_fotos_ver ON storage.objects;
CREATE POLICY vehiculo_fotos_ver
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'vehiculos');

-- Cada usuario sube unicamente dentro de su propia carpeta.
DROP POLICY IF EXISTS vehiculo_fotos_subir ON storage.objects;
CREATE POLICY vehiculo_fotos_subir
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vehiculos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS vehiculo_fotos_borrar ON storage.objects;
CREATE POLICY vehiculo_fotos_borrar
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vehiculos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );