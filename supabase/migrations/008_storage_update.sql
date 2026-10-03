-- ==================================================================
-- 008 · Permisos de sobrescritura en Storage
--
-- La subida de fotos usa upsert: si el archivo ya existe en esa ruta, la
-- API necesita permiso de UPDATE, no solo de INSERT. Con solo la policy
-- de INSERT, reescribir un archivo fallaba con "new row violates
-- row-level security policy".
--
-- Cuando ocurre en la interfaz: al editar una publicacion y cambiar las
-- fotos, las nuevas ocupan las rutas {user}/{vehiculo}/{NN}.ext que ya
-- usaban las anteriores, asi que es un caso normal y no un error.
--
-- Se permite sobrescribir solo dentro de la carpeta del propio usuario,
-- igual que la subida y el borrado.
-- ==================================================================

DROP POLICY IF EXISTS vehiculo_fotos_actualizar ON storage.objects;

CREATE POLICY vehiculo_fotos_actualizar
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'vehiculos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'vehiculos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );