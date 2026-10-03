import { createContext, useContext } from 'react'

/**
 * El contexto vive aparte del componente Proveedor para que ese archivo
 * exporte solo componentes: mixing componentes y hooks en el mismo
 * archivo rompe el Fast Refresh del navegador durante el desarrollo.
 *
 * Claves de la sesion:
 *   usuario      auth user de Supabase, o null
 *   perfil       fila de `profiles`, solo del usuario conectado
 *   cargando     true mientras se resuelve la sesion inicial
 */
export const ContextoAuth = createContext(null)

export function useAuth() {
  const contexto = useContext(ContextoAuth)
  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de <ProveedorAuth>')
  }
  return contexto
}