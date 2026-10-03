-- 001 · Esquema
-- ==================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  nombre      text NOT NULL CHECK (char_length(nombre) BETWEEN 2 AND 60),
  apellido    text NOT NULL CHECK (char_length(apellido) BETWEEN 2 AND 60),
  telefono    text NOT NULL CHECK (char_length(telefono) BETWEEN 7 AND 20),
  correo      text NOT NULL,
  creado_en   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS
  'Datos publicos del usuario. El correo no se expone al publico: se sincroniza desde auth.users.';

-- vehiculos · publicacion + parametros de subasta
-- monto_actual y total_pujas se desnormalizan aqui a proposito:
-- permiten exponer la oferta mas alta SIN abrir lectura sobre pujas,
-- que es lo que garantiza el anonimato de los postores.
CREATE TABLE IF NOT EXISTS public.vehiculos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,

  -- Ficha tecnica
  anio             integer NOT NULL CHECK (anio BETWEEN 1900 AND 2100),
  tipo_articulo    text NOT NULL CHECK (char_length(tipo_articulo) BETWEEN 2 AND 60),
  marca            text NOT NULL CHECK (char_length(marca) BETWEEN 1 AND 60),
  modelo           text NOT NULL CHECK (char_length(modelo) BETWEEN 1 AND 60),
  motor            text NOT NULL CHECK (char_length(motor) BETWEEN 2 AND 60),
  transmision      text NOT NULL CHECK (char_length(transmision) BETWEEN 2 AND 40),
  combustible      text NOT NULL CHECK (char_length(combustible) BETWEEN 2 AND 40),
  tren_manejo      text NOT NULL CHECK (tren_manejo IN ('AWD', 'FWD', 'RWD', '4WD')),
  num_cilindros    integer NOT NULL CHECK (num_cilindros BETWEEN 1 AND 16),
  nivel_dano       text NOT NULL CHECK (nivel_dano IN ('verde', 'amarillo', 'rojo')),
  descripcion      text,

  -- Parametros de subasta
  monto_base       numeric(12, 2) NOT NULL CHECK (monto_base > 0),
  fecha_inicio     timestamptz NOT NULL,
  fecha_cierre     timestamptz NOT NULL,

  -- Control
  estado           text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'activo')),
  monto_actual     numeric(12, 2) NOT NULL DEFAULT 0 CHECK (monto_actual >= 0),
  total_pujas      integer NOT NULL DEFAULT 0 CHECK (total_pujas >= 0),
  creado_en        timestamptz NOT NULL DEFAULT now(),
  actualizado_en   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT vehiculo_fechas_validas CHECK (fecha_cierre > fecha_inicio)
);

COMMENT ON TABLE public.vehiculos IS
  'Vehiculos publicados y sus subastas. monto_actual es la unica oferta expuesta al publico.';
COMMENT ON COLUMN public.vehiculos.monto_actual IS
  'Oferta mas alta. Se actualiza por trigger al insertar en pujas. No se expone user_id de los postores.';

CREATE INDEX IF NOT EXISTS idx_vehiculos_marca       ON public.vehiculos (lower(marca));
CREATE INDEX IF NOT EXISTS idx_vehiculos_modelo      ON public.vehiculos (lower(modelo));
CREATE INDEX IF NOT EXISTS idx_vehiculos_anio        ON public.vehiculos (anio);
CREATE INDEX IF NOT EXISTS idx_vehiculos_combustible ON public.vehiculos (combustible);
CREATE INDEX IF NOT EXISTS idx_vehiculos_dano        ON public.vehiculos (nivel_dano);
CREATE INDEX IF NOT EXISTS idx_vehiculos_transmision ON public.vehiculos (transmision);
CREATE INDEX IF NOT EXISTS idx_vehiculos_tren        ON public.vehiculos (tren_manejo);
CREATE INDEX IF NOT EXISTS idx_vehiculos_cilindros   ON public.vehiculos (num_cilindros);
CREATE INDEX IF NOT EXISTS idx_vehiculos_tipo        ON public.vehiculos (tipo_articulo);
CREATE INDEX IF NOT EXISTS idx_vehiculos_cierre      ON public.vehiculos (fecha_cierre);
CREATE INDEX IF NOT EXISTS idx_vehiculos_publicador  ON public.vehiculos (user_id);

-- fotos_vehiculo · galeria. El enunciado exige minimo 5 por vehiculo,
-- pero eso lo valida fn_activar_publicacion para no bloquear la carga
-- de fotos antes de tener el id del vehiculo.
CREATE TABLE IF NOT EXISTS public.fotos_vehiculo (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehiculo_id   uuid NOT NULL REFERENCES public.vehiculos (id) ON DELETE CASCADE,
  storage_path  text NOT NULL,
  url           text NOT NULL,
  orden         integer NOT NULL DEFAULT 0,
  creado_en     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fotos_vehiculo ON public.fotos_vehiculo (vehiculo_id, orden);

-- pujas · ofertas. SIN NINGUNA POLITICA DE LECTURA: la identidad de
-- quien oferta no sale del servidor. El publico solo ve el monto.
CREATE TABLE IF NOT EXISTS public.pujas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehiculo_id  uuid NOT NULL REFERENCES public.vehiculos (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  monto        numeric(12, 2) NOT NULL CHECK (monto > 0),
  creado_en    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pujas_vehiculo ON public.pujas (vehiculo_id, monto DESC);

-- Funciones puras (sin efectos sobre tablas)

-- Estado de la subasta derivado de las fechas. Evita depender de un
-- cron: el cierre se calcula al leer.
--   borrador | programada | activa | vendida | desierta
CREATE OR REPLACE FUNCTION public.fn_texto_estado(
  p_estado         text,
  p_fecha_inicio   timestamptz,
  p_fecha_cierre   timestamptz,
  p_monto_actual   numeric,
  p_monto_base     numeric,
  p_total_pujas    integer
)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_estado = 'borrador' THEN 'borrador'
    WHEN now() < p_fecha_inicio THEN 'programada'
    WHEN now() < p_fecha_cierre THEN 'activa'
    WHEN p_total_pujas > 0 AND p_monto_actual >= p_monto_base THEN 'vendida'
    ELSE 'desierta'
  END;
$$;

-- Oferta minima aceptable.
--   Sin pujas previas  -> el monto base (Q. 20.000 inicial es valido).
--   Con pujas         -> monto actual + 10%, redondeado a Q. 100.
-- El minimo siempre es > monto_actual cuando hay pujas, lo que ademas
-- impide empates: nunca puede haber dos pujas por el mismo monto.
CREATE OR REPLACE FUNCTION public.fn_monto_minimo(
  p_monto_base   numeric,
  p_monto_actual numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ceil(greatest(p_monto_base, coalesce(p_monto_actual, 0) * 1.10) / 100) * 100;
$$;

-- Mantenimiento

-- Crear el perfil automaticamente al registrarse en Supabase Auth.
-- Los datos llegan en raw_user_meta_data desde el formulario de registro.
CREATE OR REPLACE FUNCTION public.fn_trg_crear_perfil()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, apellido, telefono, correo)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', 'Usuario'),
    coalesce(new.raw_user_meta_data ->> 'apellido', 'Demo'),
    coalesce(new.raw_user_meta_data ->> 'telefono', '00000000'),
    new.email
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_crear_perfil ON auth.users;
CREATE TRIGGER trg_crear_perfil
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.fn_trg_crear_perfil();

-- Marcar actualizado_en en cada cambio del vehiculo.
CREATE OR REPLACE FUNCTION public.fn_trg_actualizado_en()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vehiculos_actualizado ON public.vehiculos;
CREATE TRIGGER trg_vehiculos_actualizado
BEFORE UPDATE ON public.vehiculos
FOR EACH ROW
EXECUTE FUNCTION public.fn_trg_actualizado_en();

-- Reflejar la oferta en vehiculos.monto_actual / total_pujas.
-- Es la unica via por la que el monto se propaga a la vista publica.
CREATE OR REPLACE FUNCTION public.fn_trg_reflejar_puja()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vehiculos
     SET monto_actual = NEW.monto,
         total_pujas  = public.vehiculos.total_pujas + 1
   WHERE id = NEW.vehiculo_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reflejar_puja ON public.pujas;
CREATE TRIGGER trg_reflejar_puja
AFTER INSERT ON public.pujas
FOR EACH ROW
EXECUTE FUNCTION public.fn_trg_reflejar_puja();