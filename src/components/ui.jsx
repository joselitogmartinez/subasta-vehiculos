// Primitivas de interfaz reutilizadas en toda la aplicacion.
// Son deliberadamente simples: envuelven <button>, <input>, <span>, etc.
// para que el estilo viva en una sola hoja (ui.css) y el marcado se lea
// sin ruido.

import { useId } from 'react'
import '../styles/ui.css'

// ------------------------------------------------------------------
// Boton
// ------------------------------------------------------------------
export function Boton({
  variante = 'primario',
  tamano = 'md',
  cargando = false,
  ancho = false,
  children,
  className = '',
  disabled,
  ...props
}) {
  const clases = [
    'btn',
    `btn--${variante}`,
    tamano !== 'md' && `btn--${tamano}`,
    ancho && 'btn--ancho',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={clases} disabled={cargando || disabled} {...props}>
      {cargando && <span className="btn__spinner" aria-hidden="true" />}
      <span className={cargando ? 'btn__contenido--oculto' : undefined}>{children}</span>
    </button>
  )
}

// ------------------------------------------------------------------
// Campo de formulario
// ------------------------------------------------------------------
export function Campo({
  etiqueta,
  error,
  ayuda,
  contenedor,
  className = '',
  multilinea = false,
  filas = 3,
  id,
  ...props
}) {
  const generado = useId()
  const campoId = id ?? generado
  const describedBy = error ? `${campoId}-error` : ayuda ? `${campoId}-ayuda` : undefined
  const clases = `campo__input ${error ? 'campo__input--error' : ''}`.trim()

  const comunes = {
    id: campoId,
    className: clases,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': describedBy,
    ...props,
  }

  return (
    <div className={`campo ${contenedor ?? ''} ${className}`.trim()}>
      <label className="campo__etiqueta" htmlFor={campoId}>
        {etiqueta}
      </label>

      {multilinea ? (
        <textarea rows={filas} {...comunes} />
      ) : (
        <input {...comunes} />
      )}

      {error ? (
        <p className="campo__error" id={`${campoId}-error`}>
          {error}
        </p>
      ) : ayuda ? (
        <p className="campo__ayuda" id={`${campoId}-ayuda`}>
          {ayuda}
        </p>
      ) : null}
    </div>
  )
}

// ------------------------------------------------------------------
// Select, mismo estilo que Campo. `opciones` acepta cadenas sueltas o
// pares { valor, texto } cuando lo que se guarda no es lo que se ve.
// ------------------------------------------------------------------
export function Seleccion({ etiqueta, error, ayuda, opciones = [], placeholder, id, ...props }) {
  const generado = useId()
  const campoId = id ?? generado

  return (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={campoId}>
        {etiqueta}
      </label>
      <div className="campo__select">
        <select id={campoId} className={error ? 'campo__input--error' : undefined} {...props}>
          {placeholder && <option value="">{placeholder}</option>}
          {opciones.map((o) => {
            const valor = typeof o === 'string' ? o : o.valor
            const texto = typeof o === 'string' ? o : o.texto
            return (
              <option key={valor} value={valor}>
                {texto}
              </option>
            )
          })}
        </select>
      </div>
      {error ? (
        <p className="campo__error">{error}</p>
      ) : ayuda ? (
        <p className="campo__ayuda">{ayuda}</p>
      ) : null}
    </div>
  )
}

// ------------------------------------------------------------------
// Badge
// ------------------------------------------------------------------
export function Badge({ tono = 'neutro', punto = false, children }) {
  return (
    <span className={`badge badge--${tono}`}>
      {punto && <span className="badge__punto" aria-hidden="true" />}
      {children}
    </span>
  )
}

// ------------------------------------------------------------------
// Alerta
// ------------------------------------------------------------------
export function Alerta({ tono = 'info', titulo, children }) {
  if (!children && !titulo) return null

  return (
    <div className={`alerta alerta--${tono}`} role={tono === 'error' ? 'alert' : 'status'}>
      {titulo && <strong className="alerta__titulo">{titulo}</strong>}
      {children && <span className="alerta__texto">{children}</span>}
    </div>
  )
}

// ------------------------------------------------------------------
// Estados de carga y vacio
// ------------------------------------------------------------------
export function Cargando({ texto = 'Cargando...' }) {
  return (
    <div className="cargando" role="status">
      <span className="cargando__spinner" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  )
}

export function Vacio({ titulo, children, accion }) {
  return (
    <div className="vacio">
      <div className="vacio__icono" aria-hidden="true">
        🔍
      </div>
      <h3 className="vacio__titulo">{titulo}</h3>
      {children && <p className="vacio__texto">{children}</p>}
      {accion}
    </div>
  )
}