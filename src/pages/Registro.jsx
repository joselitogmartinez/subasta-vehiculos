import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authContexto'
import { Alerta, Boton, Campo } from '../components/ui'
import { mensajeDeError } from '../lib/formato'
import { fuerzaPassword, validarRegistro } from '../lib/validacion'
import '../styles/auth.css'

const VACIO = {
  nombre: '',
  apellido: '',
  correo: '',
  telefono: '',
  password: '',
  repetir: '',
}

export default function Registro() {
  const { registrar } = useAuth()
  const navegar = useNavigate()

  const [form, setForm] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [enviando, setEnviando] = useState(false)

  const fuerza = fuerzaPassword(form.password)

  const cambiar = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
    setErrores((x) => ({ ...x, [name]: undefined }))
    setError('')
    setExito('')
  }

  const enviar = async (e) => {
    e.preventDefault()

    const problemas = validarRegistro(form)
    setErrores(problemas)
    if (Object.keys(problemas).length > 0) return

    setEnviando(true)
    try {
      const data = await registrar(form)

      // Si el proyecto exige confirmar correo, Supabase no abre sesion
      // en el registro: hay que avisar en vez de llevar al inicio.
      if (data.session) {
        navegar('/', { replace: true })
      } else {
        setExito(
          'Cuenta creada. Revisa tu correo para confirmar la direccion y luego inicia sesion.',
        )
        setForm(VACIO)
      }
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth__panel auth__panel--ancho">
        <div className="auth__cabecera">
          <h1 className="auth__titulo">Crea tu cuenta</h1>
          <p className="auth__sub">
            Registrate para publicar vehiculos en subasta y ofertar en vivo por los de otros.
          </p>
        </div>

        {error && (
          <Alerta tono="error" titulo="No pudimos crear la cuenta">
            {error}
          </Alerta>
        )}

        {exito && <Alerta tono="exito">{exito}</Alerta>}

        <form className="auth__form auth__form--rejilla" onSubmit={enviar} noValidate>
          <Campo
            etiqueta="Nombre"
            name="nombre"
            autoComplete="given-name"
            placeholder="Maria"
            value={form.nombre}
            onChange={cambiar}
            error={errores.nombre}
            required
          />

          <Campo
            etiqueta="Apellido"
            name="apellido"
            autoComplete="family-name"
            placeholder="Gonzalez"
            value={form.apellido}
            onChange={cambiar}
            error={errores.apellido}
            required
          />

          <Campo
            contenedor="campo--ancho"
            etiqueta="Correo electronico"
            type="email"
            name="correo"
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
            value={form.correo}
            onChange={cambiar}
            error={errores.correo}
            required
          />

          <Campo
            contenedor="campo--ancho"
            etiqueta="Telefono"
            type="tel"
            name="telefono"
            autoComplete="tel"
            placeholder="+502 5555 0100"
            value={form.telefono}
            onChange={cambiar}
            error={errores.telefono}
            ayuda="Lo usaremos para avisarte cuando ganes una subasta."
            required
          />

          <div className="campo--ancho auth__password">
            <Campo
              etiqueta="Contrasena"
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="Minimo 8 caracteres"
              value={form.password}
              onChange={cambiar}
              error={errores.password}
              required
            />

            <div
              className="auth__fuerza"
              role="meter"
              aria-valuenow={fuerza.nivel}
              aria-valuemin={0}
              aria-valuemax={4}
              aria-label="Fuerza de la contrasena"
            >
              <div className="auth__fuerza-barras">
                {[1, 2, 3, 4].map((n) => (
                  <span
                    key={n}
                    className={`auth__fuerza-barra auth__fuerza-barra--${fuerza.nivel >= n ? fuerza.nivel : 0}`}
                  />
                ))}
              </div>
              <span className="auth__fuerza-texto">{fuerza.texto}</span>
            </div>

            <ul className="auth__requisitos">
              <li className={form.password.length >= 8 ? 'cumple' : ''}>8 caracteres o mas</li>
              <li className={/[A-Z]/.test(form.password) ? 'cumple' : ''}>Una mayuscula</li>
              <li className={/[a-z]/.test(form.password) ? 'cumple' : ''}>Una minuscula</li>
              <li className={/\d/.test(form.password) ? 'cumple' : ''}>Un numero</li>
            </ul>
          </div>

          <Campo
            contenedor="campo--ancho"
            etiqueta="Repetir contrasena"
            type="password"
            name="repetir"
            autoComplete="new-password"
            placeholder="Escribela otra vez"
            value={form.repetir}
            onChange={cambiar}
            error={errores.repetir}
            required
          />

          <div className="auth__acciones">
            <Boton type="submit" ancho cargando={enviando}>
              {enviando ? 'Creando cuenta...' : 'Crear mi cuenta'}
            </Boton>
            <p className="auth__legal">
              Al crear la cuenta aceptas usar estos datos unicamente dentro de esta
              plataforma de practicas.
            </p>
          </div>
        </form>

        <p className="auth__pie">
          Ya tienes cuenta? <Link to="/login">Inicia sesion</Link>
        </p>
      </div>
    </div>
  )
}