-- 007 · Privilegios de la galeria
-- ==================================================================

GRANT INSERT, DELETE ON public.fotos_vehiculo TO authenticated;

COMMENT ON TABLE public.fotos_vehiculo IS
  'Galeria del vehiculo. INSERT y DELETE solo para el dueno, por policy RLS.';