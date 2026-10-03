import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ContextoAuth } from './authContexto'

/**
 * Sesion del usuario y operaciones de autenticacion.
 *
 * El perfil (nombre, apellido, telefono) se lee de `profiles`, que solo
 * es legible por su propio dueno gracias a la policy RLS. El perfil lo
 * crea el trigger `trg_crear_perfil` a partir de los metadatos enviados
 * en el registro, asi que no existe una segunda escritura susceptible
 * de desincronizarse.
 */
export default function ProveedorAuth({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)

  // Perfiles cacheados por id. Evita tener que "limpiar" el perfil
  // anterior en un efecto cuando se cierra la sesion: si no hay usuario
  // no hay id y no hay entrada en la cache.
  const [perfiles, setPerfiles] = useState({})

  // Sesion inicial y escucha de cambios (login, logout, refresh token).
  useEffect(() => {
    let vigente = true

    supabase.auth.getSession().then(({ data }) => {
      if (!vigente) return
      setUsuario(data.session?.user ?? null)
      setCargando(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setUsuario(nuevaSesion?.user ?? null)
      setCargando(false)
    })

    return () => {
      vigente = false
      subscription.unsubscribe()
    }
  }, [])

  // Carga el perfil del usuario conectado, una vez por id.
  useEffect(() => {
    const id = usuario?.id
    if (!id || perfiles[id]) return

    let vigente = true

    supabase
      .from('profiles')
      .select('id, nombre, apellido, telefono')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (vigente && data) {
          setPerfiles((cache) => ({ ...cache, [id]: data }))
        }
      })

    return () => {
      vigente = false
    }
  }, [usuario?.id, perfiles])

  const valor = useMemo(
    () => ({
      usuario,
      perfil: usuario?.id ? (perfiles[usuario.id] ?? null) : null,
      cargando,
      autenticado: !!usuario,

      async iniciarSesion(correo, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: correo.trim().toLowerCase(),
          password,
        })
        if (error) throw error
        return data.user
      },

      async registrar({ nombre, apellido, correo, telefono, password }) {
        // `options.data` es lo que lee el trigger para crear el perfil.
        const { data, error } = await supabase.auth.signUp({
          email: correo.trim().toLowerCase(),
          password,
          options: {
            data: {
              nombre: nombre.trim(),
              apellido: apellido.trim(),
              telefono: telefono.trim(),
            },
          },
        })
        if (error) throw error
        return data
      },

      async cerrarSesion() {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      },
    }),
    [usuario, perfiles, cargando],
  )

  return <ContextoAuth.Provider value={valor}>{children}</ContextoAuth.Provider>
}