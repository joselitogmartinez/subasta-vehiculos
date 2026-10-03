import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/authContexto'
import { Cargando } from './ui'

/**
 * Envuelve las rutas que exigen sesion iniciada (/publicar y
 * /mis-publicaciones). Es la primera linea del bloqueo a anónimos que
 * pide el enunciado; la segunda son las policies de RLS y las funciones
 * fn_* del servidor, que ya rechazan cualquier escritura anonima.
 *
 * `state={{ desde }}` recuerda la ruta para devolver al usuario a donde
 * estaba despues de iniciar sesion.
 */
export default function Privado({ children }) {
  const { autenticado, cargando } = useAuth()
  const ubicacion = useLocation()

  // Mientras se consulta la sesion no se decide nada: si se redirigiera
  // aqui, un usuario con sesion veria el login al recargar la pagina.
  if (cargando) {
    return (
      <div className="pagina-centrada">
        <Cargando texto="Verificando tu sesion..." />
      </div>
    )
  }

  if (!autenticado) {
    return <Navigate to="/login" state={{ desde: ubicacion.pathname }} replace />
  }

  return children
}

/** Inverso de Privado: si ya hay sesion, no tiene sentido ver el login. */
export function SoloAnonimo({ children }) {
  const { autenticado, cargando } = useAuth()

  if (cargando) {
    return (
      <div className="pagina-centrada">
        <Cargando texto="Cargando..." />
      </div>
    )
  }

  if (autenticado) return <Navigate to="/" replace />

  return children
}