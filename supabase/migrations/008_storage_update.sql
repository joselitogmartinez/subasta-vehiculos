-- 008 · Permisos de sobrescritura en Storage
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