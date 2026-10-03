import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alerta, Badge, Boton, Campo } from './ui'
import { dinero, etiquetaDano, etiquetaEstado, fechaHora, mensajeDeError } from '../lib/formato'
import { parsearMonto, situacionPostor, sugerenciasPuja, guardarMiOferta } from '../lib/subasta'

/**
 * Panel de subasta en vivo.
 *
 * Muestra la oferta vigente, el indicador de si el visitante va ganando y
 * el formulario de puja. Todas las reglas se validan otra vez en el
 * servidor; aqui solo se evita que el usuario pierda tiempo con una
 * oferta que ya se sabe invalida.
 */
export default function PanelPuja({
  vehiculo,
  estado,
  miOferta,
  autenticado,
  usuarioId,
  esMio,
  conectado,
  alOfertar,
}) {
  const [monto, setMonto] = useState('')
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [enviando, setEnviando] = useState(false)

  const situacion = useMemo(
    () => situacionPostor({ ...estado, miOferta, autenticado, esMio }),
    [estado, miOferta, autenticado, esMio],
  )

  const sugerencias = useMemo(
    () => sugerenciasPuja(estado.monto_minimo, miOferta),
    [estado.monto_minimo, miOferta],
  )

const minimo = Number(estado.monto_minimo) || 0
  const montoNumerico = parsearMonto(monto)

  const enviar = async (e) => {
    e?.preventDefault()
    setError('')
    setExito('')

    if (montoNumerico === null) {
      setError('Escribe el monto de tu oferta.')
      return
    }
    if (montoNumerico < minimo) {
      setError(`La oferta minima es ${dinero(minimo)}.`)
      return
    }

    setEnviando(true)
    try {
      await alOfertar(montoNumerico)
      guardarMiOferta(vehiculo.id, usuarioId, montoNumerico)
      setMonto('')
      setExito(`¡Oferta registrada por ${dinero(montoNumerico)}! Tu oferta esta en cabeza.`)
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setEnviando(false)
    }
  }

  const hayPujas = estado.total_pujas > 0

  return (
    <section className="puja">
      <header className="puja__cabecera">
        <div>
          <span className="puja__etiqueta">{hayPujas ? 'Oferta actual' : 'Monto base'}</span>
          <span className="puja__monto">
            {dinero(hayPujas ? estado.monto_actual : estado.monto_base)}
          </span>
        </div>
        <div className="puja__contador">
          <span className="puja__contador-numero">{estado.total_pujas}</span>
          <span className="puja__contador-texto">
            {estado.total_pujas === 1 ? 'oferta' : 'ofertas'}
          </span>
        </div>
      </header>

      {/* Indicador de estado. Es el requisito S3.1: cambia en vivo. */}
      <div className={`indicador indicador--${situacion.tono}`} role="status" aria-live="polite">
        <span className="indicador__icono" aria-hidden="true">
          {situacion.icono}
        </span>
        <span className="indicador__texto">{situacion.texto}</span>
      </div>

      {!autenticado && (
        <div className="puja__acceso">
          <p>Navegar el catalogo es libre, pero ofertar exige cuenta.</p>
          <div className="puja__acceso-botones">
            <Link to="/login" state={{ desde: `/vehiculo/${vehiculo.id}` }}>
              Iniciar sesion
            </Link>
            <Link to="/registro" state={{ desde: `/vehiculo/${vehiculo.id}` }}>
              Crear cuenta
            </Link>
          </div>
        </div>
      )}

      {autenticado && esMio && (
        <div className="puja__propietario">
          <p>
            Esta publicacion es tuya. Puedes seguir el avance desde aqui o editar los datos
            y las fotos cuando quieras.
          </p>
          <Link className="btn btn--secundario btn--ancho" to="/mis-publicaciones">
            Gestionar mi publicacion
          </Link>
        </div>
      )}

      {autenticado && !esMio && estado.estado === 'activa' && (
        <form className="puja__form" onSubmit={enviar} noValidate>
          <div className="puja__minimo">
            <span>Oferta minima</span>
            <strong>{dinero(minimo)}</strong>
            {miOferta && <span className="puja__minimo-nota">Tu ultima: {dinero(miOferta)}</span>}
          </div>

          {sugerencias.length > 0 && (
            <div className="puja__sugerencias">
              {sugerencias.map((s) => (
                <button
                  key={s.monto}
                  type="button"
                  className={`puja__sugerencia ${s.repetida ? 'puja__sugerencia--usada' : ''}`}
                  onClick={() => {
                    setMonto(String(s.monto))
                    setError('')
                    setExito('')
                  }}
                  disabled={s.repetida}
                >
                  <strong>{dinero(s.monto)}</strong>
                  <span>{s.repetida ? 'ya es tu oferta' : s.etiqueta}</span>
                </button>
              ))}
            </div>
          )}

          <Campo
            etiqueta="Mi oferta"
            type="text"
            inputMode="numeric"
            placeholder={dinero(minimo).replace(/[^\d]/g, '')}
            value={monto}
            onChange={(e) => {
              setMonto(e.target.value)
              setError('')
              setExito('')
            }}
            ayuda={
              montoNumerico !== null && !minimoAlcanzado
                ? `Faltan ${dinero(minimo - montoNumerico)} para alcanzar el minimo.`
                : 'Debe superar la oferta vigente en al menos un 10%.'
            }
            error={error || undefined}
            disabled={enviando}
          />

          {exito && <Alerta tono="exito">{exito}</Alerta>}

          <Boton
            type="submit"
            variante="acento"
            tamano="lg"
            ancho
            cargando={enviando}
            disabled={!minimoAlcanzado}
          >
            {enviando ? 'Enviando oferta...' : `Ofertar ${minimoAlcanzado ? dinero(montoNumerico) : ''}`}
          </Boton>

          <p className="puja__legal">
            Al ofertar confirmas que entiendes que esta es una plataforma de practica.
          </p>
        </form>
      )}

      {estado.estado !== 'activa' && (
        <div className="puja__cerrada">
          <Badge tono={etiquetaEstado(estado.estado).tono} punto>
            {etiquetaEstado(estado.estado).texto}
          </Badge>
          <p>
            {estado.estado === 'programada' && 'La oferta estara disponible cuando comience la subasta.'}
            {estado.estado === 'desierta' &&
              `No se alcanzo el monto base de ${dinero(estado.monto_base)}, por lo que la subasta se declara desierta.`}
            {estado.estado === 'vendida' &&
              `La subasta cerro en ${dinero(estado.monto_actual)}.`}
            {estado.estado === 'borrador' && 'Esta publicacion todavia no esta publicada.'}
          </p>
        </div>
      )}

      <footer className="puja__pie">
        <span className={`puja__conexion ${conectado ? 'puja__conexion--ok' : ''}`}>
          <span className="puja__conexion-punto" aria-hidden="true" />
          {conectado ? 'Actualizacion en vivo activa' : 'Conectando...'}
        </span>
        <span className="puja__dano">
          <Badge tono={etiquetaDano(vehiculo.nivel_dano).punto} punto>
            {etiquetaDano(vehiculo.nivel_dano).texto}
          </Badge>
        </span>
      </footer>

      <p className="puja__fechas">
        Abre {fechaHora(vehiculo.fecha_inicio)} · Cierra {fechaHora(vehiculo.fecha_cierre)}
      </p>
    </section>
  )
}