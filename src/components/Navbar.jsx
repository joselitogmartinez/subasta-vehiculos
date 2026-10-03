import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authContexto'
import { Boton } from './ui'
import '../styles/navbar.css'

export default function Navbar() {
  const { usuario, perfil, autenticado, cargando, cerrarSesion } = useAuth()
  const navegar = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const contenedorRef = useRef(null)

  useEffect(() => {
    if (!menuAbierto) return

    const alClicFuera = (e) => {
      if (!contenedorRef.current?.contains(e.target)) setMenuAbierto(false)
    }
    const alEscape = (e) => {
      if (e.key === 'Escape') setMenuAbierto(false)
    }

    document.addEventListener('mousedown', alClicFuera)
    document.addEventListener('keydown', alEscape)
    return () => {
      document.removeEventListener('mousedown', alClicFuera)
      document.removeEventListener('keydown', alEscape)
    }
  }, [menuAbierto])

  const alCerrarSesion = async () => {
    await cerrarSesion()
    setMenuAbierto(false)
    navegar('/')
  }

  const nombreMostrado = perfil
    ? `${perfil.nombre} ${perfil.apellido}`
    : (usuario?.email ?? '')

  const iniciales = perfil
    ? `${perfil.nombre.charAt(0)}${perfil.apellido.charAt(0)}`.toUpperCase()
    : (usuario?.email ?? '?').charAt(0).toUpperCase()

  return (
    <header className="nav">
      <div className="nav__interior">
        <Link to="/" className="nav__marca" onClick={() => setMenuAbierto(false)}>
          <span className="nav__logo" aria-hidden="true">
            ðŸš—
          </span>
          <span className="nav__nombre">
            Subasta<span className="nav__nombre--acento">YA</span>
          </span>
        </Link>

        <button
          type="button"
          className="nav__hamburguesa"
          aria-expanded={menuAbierto}
          aria-controls="nav-principal"
          onClick={() => setMenuAbierto((v) => !v)}
        >
          <span className="nav__hamburguesa-barra" aria-hidden="true" />
          <span className="sr-solo">Menu</span>
        </button>

        <div
          id="nav-principal"
          ref={contenedorRef}
          className={`nav__panel ${menuAbierto ? 'nav__panel--abierto' : ''}`}
        >
          <nav className="nav__enlaces" aria-label="Principal">
            <NavLink to="/" end onClick={() => setMenuAbierto(false)}>
              Inicio
            </NavLink>
            {autenticado && (
              <>
                <NavLink to="/publicar" onClick={() => setMenuAbierto(false)}>
                  Publicar vehiculo
                </NavLink>
                <NavLink to="/mis-publicaciones" onClick={() => setMenuAbierto(false)}>
                  Mis publicaciones
                </NavLink>
              </>
            )}
          </nav>

          <div className="nav__sesion">
            {cargando ? (
              <span className="nav__cargando" aria-hidden="true" />
            ) : autenticado ? (
              <div className="nav__usuario">
                <button
                  type="button"
                  className="nav__perfil"
                  onClick={() => setMenuAbierto((v) => !v)}
                  aria-expanded={menuAbierto}
                >
                  <span className="nav__avatar" aria-hidden="true">
                    {iniciales}
                  </span>
                  <span className="nav__perfil-datos">
                    <span className="nav__perfil-nombre">{nombreMostrado}</span>
                    <span className="nav__perfil-correo">{usuario.email}</span>
                  </span>
                </button>
                <div className={`nav__desplegable ${menuAbierto ? 'nav__desplegable--abierto' : ''}`}>
                  <NavLink to="/mis-publicaciones" onClick={() => setMenuAbierto(false)}>
                    Mis publicaciones
                  </NavLink>
                  <NavLink to="/publicar" onClick={() => setMenuAbierto(false)}>
                    Publicar vehiculo
                  </NavLink>
                  <button type="button" onClick={alCerrarSesion}>
                    Cerrar sesion
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="nav__enlace-secundario"
                  onClick={() => setMenuAbierto(false)}
                >
                  Iniciar sesion
                </Link>
                <Boton variante="acento" tamano="sm" onClick={() => navegar('/registro')}>
                  Crear cuenta
                </Boton>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}