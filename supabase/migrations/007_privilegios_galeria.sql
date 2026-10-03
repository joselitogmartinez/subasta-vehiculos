-- ==================================================================
-- 007 · Privilegios de la galeria
--
-- La migracion 002 hizo REVOKE INSERT, UPDATE, DELETE sobre
-- fotos_vehiculo para que el cliente no escribiera directo... pero en el
-- mismo archivo creo las policies fotos_agregar y fotos_borrar que si lo
-- permiten, para el dueno del vehiculo.
--
-- PostgreSQL evalua el privilegio de tabla ANTES que la policy: sin el
-- INSERT concedido, el policy fotos_agregar nunca llega amirarse y la
-- subida de fotos falla con "permission denied for table".
--
-- Consecuencia que se observo: al publicar, las 5+ fotos se subian al
-- bucket pero no se registraban en la base, y fn_activar_vehiculo
-- rechazaba la publicacion con "Se requieren al menos 5 fotografias.
-- Llevas 0".
--
-- Se conceden INSERT y DELETE. UPDATE sigue revocado a proposito: el
-- orden de las fotos no lo cambia el cliente de forma arbitraria, lo
-- controla el servidor. La seguridad no se debilita porque las policies
-- siguen limitando ambas operaciones a vehiculos del propio usuario.
-- ==================================================================

GRANT INSERT, DELETE ON public.fotos_vehiculo TO authenticated;

COMMENT ON TABLE public.fotos_vehiculo IS
  'Galeria del vehiculo. INSERT y DELETE solo para el dueno, por policy RLS.';