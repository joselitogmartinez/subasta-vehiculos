import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authContexto'
import { Alerta, Boton, Campo } from '../components/ui'
import { mensajeDeError } from '../lib/formato'
import '../styles/auth.css'

export default function Login() {
  const { iniciarSesion } = useAuth()
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const destino = ubicacion.state?.desde ?? '/'

  const [form, setForm] = useState({ correo: '', password: '' })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cambiar = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    setError('')
  }

  const enviar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    setError('')

    try {
      await iniciarSesion(form.correo, form.password)
      navegar(destino, { replace: true })
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth__panel">
        <div className="auth__cabecera">
          <h1 className="auth__titulo">Inicia sesion</h1>
          <p className="auth__sub">
            Necesitas una cuenta para ofertar en subastas y publicar vehiculos. Navegar el
            catalogo no requiere iniciar sesion.
          </p>
        </div>

        {error && (
          <Alerta tono="error" titulo="No pudimos iniciar sesion">
            {error}
          </Alerta>
        )}

        <form className="auth__form" onSubmit={enviar} noValidate>
          <Campo
            etiqueta="Correo electronico"
            type="email"
            name="correo"
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
            value={form.correo}
            onChange={cambiar}
            required
          />

          <Campo
            etiqueta="Contrasena"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Tu contrasena"
            value={form.password}
            onChange={cambiar}
            required
          />

          <Boton type="submit" ancho cargando={enviando}>
            {enviando ? 'Entrando...' : 'Entrar'}
          </Boton>
        </form>

        <p className="auth__pie">
            Todavia no tienes cuenta?{' '}
          <Link to="/registro" state={ubicacion.state}>
            Crear una cuenta gratis
          </Link>
        </p>

        <div className="auth__demo">
          <p className="auth__demo-titulo">Usuarios de prueba</p>
          <ul className="auth__demo-lista">
            <li>
              <code>maria@subasta.com</code>
              <code>carlos@subasta.com</code>
              <code>ana@subasta.com</code>
            </li>
            <li>
              Contrasena para los tres: <code>Subasta2026!</code>
            </li>
          </ul>
          <p className="auth__demo-nota">
            Abre el mismo vehiculo en dos ventanas de incognito distintas, inicia sesion con
            un usuario en cada una y puja desde una: la otra se actualiza sola.
          </p>
        </div>
      </div>
    </div>
  )
}