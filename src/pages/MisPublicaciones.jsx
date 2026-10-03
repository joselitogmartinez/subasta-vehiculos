import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Alerta, Badge, Boton, Cargando, Vacio } from '../components/ui'
import { useAuth } from '../context/authContexto'
import { supabase } from '../lib/supabase'
import { faltanFotos, limpiarArchivos } from '../lib/galeria'
import { dinero, etiquetaEstado, fechaHora, mensajeDeError } from '../lib/formato'
import '../styles/publicar.css'

const subastaTexto = (n) => (n === 1 ? ' subasta' : ' subastas')

/**
 * Gestion de las publicaciones propias: buscar, editar, activar y
 * eliminar. El enunciado pide expresamente que el publicador pueda
 * buscar las suyas y editarlas.
 *
 * Se listan tambien las que estan en borrador, a diferencia del
 * catalogo publico, que solo muestra las activas.
 */
export default function MisPublicaciones() {
  const navegar = useNavigate()
  const { usuario } = useAuth()

  const [vehiculos, setVehiculos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(null)
  const [confirmando, setConfirmando] = useState(null)

  // despues de publicar o eliminar, donde el usuario ya sabe que hay
  // algo pasando y un spinner taparia la pantalla.
  const recargar = useCallback(async () => {
    // La policy de RLS deja ver al dueno sus propias publicaciones,
    // incluidas las que siguen en borrador.
    const { data, error: err } = await supabase
      .from('vw_vehiculos')
      .select('*')
      .order('actualizado_en', { ascending: false })

    if (err) setError(err.message)
    else setError('')
    setVehiculos(data ?? [])
  }, [])

  useEffect(() => {
    let vigente = true

    // La IIFE awaits antes de tocar el estado: el setState cae en una
    // continuacion asincrona y no en este render.
    ;(async () => {
      await recargar()
      if (vigente) setCargando(false)
    })()

    return () => {
      vigente = false
    }
  }, [recargar])

  const texto = busqueda.trim().toLowerCase()
  const filtrados = useMemo(
    () =>
      texto === ''
        ? vehiculos
        : vehiculos.filter((v) =>
            `${v.marca} ${v.modelo} ${v.tipo_articulo} ${v.anio} ${v.nivel_dano}`
              .toLowerCase()
              .includes(texto),
          ),
    [vehiculos, texto],
  )

  const conteo = useMemo(() => {
    const por = { borrador: 0, activa: 0, cerrada: 0 }
    for (const v of vehiculos) {
      if (v.estado === 'borrador') por.borrador++
      else if (v.estado_calculado === 'activa') por.activa++
      else por.cerrada++
    }
    return por
  }, [vehiculos])

  const activar = async (id) => {
    setOcupado(id)
    setError('')
    const { error: err } = await supabase.rpc('fn_activar_vehiculo', { p_vehiculo_id: id })
    if (err) setError(mensajeDeError(err))
    await recargar()
    setOcupado(null)
  }

  const eliminar = async (vehiculo) => {
    setOcupado(vehiculo.id)
    setError('')

    try {
      // El bucket se limpia primero. Borrar la fila del vehiculo arrastra
      // en cascada las filas de fotos, pero NO los archivos del bucket:
      // eso lo maneja la API de Storage, no una trigger de Postgres. Al
      // reves quedarian archivos huerfanos ocupando espacio para siempre.
      await limpiarArchivos(supabase, usuario.id, vehiculo.id)
    } catch {
      // Si falla la limpieza se sigue adelante: es preferible un archivo
      // huerfano a no poder borrar la publicacion.
    }

    const { error: err } = await supabase.rpc('fn_eliminar_vehiculo', {
      p_vehiculo_id: vehiculo.id,
    })

    if (err) {
      setError(mensajeDeError(err))
      setOcupado(null)
      return
    }

    setConfirmando(null)
    await recargar()
    setOcupado(null)
  }

  if (cargando) {
    return (
      <div className="publicar">
        <Cargando texto="Cargando tus publicaciones..." />
      </div>
    )
  }

  return (
    <div className="publicar">
      <header className="publicar__cabecera">
        <h1 className="publicar__titulo">Mis publicaciones</h1>
        <p className="publicar__sub">
          {vehiculos.length === 0 ? (
            'Todavía no has publicado ningún vehículo.'
          ) : (
            <>
              {conteo.activa} en{subastaTexto(conteo.activa)} · {conteo.borrador} en borrador ·{' '}
              {conteo.cerrada} cerrada{subastaTexto(conteo.cerrada)}
            </>
          )}
        </p>

        <div className="publicar__acciones">
          <Boton variante="acento" onClick={() => navegar('/publicar')}>
            Publicar otro vehículo
          </Boton>
        </div>
      </header>

      {error && (
        <Alerta tono="error" titulo="No pudimos completar la operación">
          {error}
        </Alerta>
      )}

      {vehiculos.length === 0 ? (
        <Vacio
          titulo="Sin publicaciones todavía"
          accion={
            <Boton variante="primario" onClick={() => navegar('/publicar')}>
              Publicar mi primer vehículo
            </Boton>
          }
        >
          Cuando publiques un vehículo aparecerá aquí con su estado, y podrás editarlo o
          quitarlo cuando quieras.
        </Vacio>
      ) : (
        <>
          <div className="publicar__buscador">
            <input
              type="search"
              className="campo__input"
              placeholder="Buscar entre mis publicaciones..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar entre mis publicaciones"
            />
            <span className="publicar__buscador-conteo">
              {filtrados.length} de {vehiculos.length}
            </span>
          </div>

          {filtrados.length === 0 ? (
            <Vacio titulo="Ninguna publicación coincide">
              Ninguna de tus publicaciones coincide con "{busqueda}". Prueba con otra marca o
              modelo.
            </Vacio>
          ) : (
            <ul className="mis-publicaciones">
              {filtrados.map((v) => {
                const estado = etiquetaEstado(v.estado_calculado)
                const fotos = v.fotos ?? []
                const faltan = faltanFotos(fotos.length)

                return (
                  <li key={v.id} className="mis-publicacion">
                    <Link to={`/vehiculo/${v.id}`} className="mis-publicacion__portada">
                      {fotos[0] ? (
                        <img src={fotos[0].url} alt={`${v.marca} ${v.modelo}`} />
                      ) : (
                        <span aria-hidden="true">🚘</span>
                      )}
                      {fotos.length > 1 && (
                        <span className="mis-publicacion__contador-fotos">
                          📷 {fotos.length}
                        </span>
                      )}
                    </Link>

                    <div className="mis-publicacion__datos">
                      <div className="mis-publicacion__linea">
                        <h3 className="mis-publicacion__titulo">
                          {v.marca} {v.modelo}
                        </h3>
                        <Badge tono={estado.tono} punto={v.estado_calculado === 'activa'}>
                          {estado.texto}
                        </Badge>
                      </div>

                      <p className="mis-publicacion__meta">
                        {v.anio} · {v.tipo_articulo} · {v.combustible} · {v.tren_manejo}
                      </p>

                      <dl className="mis-publicacion__cifras">
                        <div>
                          <dt>Monto base</dt>
                          <dd>{dinero(v.monto_base)}</dd>
                        </div>
                        <div>
                          <dt>Oferta actual</dt>
                          <dd>{dinero(v.monto_actual)}</dd>
                        </div>
                        <div>
                          <dt>Ofertas</dt>
                          <dd>{v.total_pujas}</dd>
                        </div>
                        <div>
                          <dt>Cierra</dt>
                          <dd>{fechaHora(v.fecha_cierre)}</dd>
                        </div>
                      </dl>

                      {v.estado === 'borrador' && faltan > 0 && (
                        <p className="mis-publicacion__pendiente">
                          Le faltan {faltan} fotografía{faltan === 1 ? '' : 's'} para poder
                          publicar.
                        </p>
                      )}
                    </div>

                    <div className="mis-publicacion__acciones">
                      {v.estado === 'borrador' ? (
                        <Boton
                          variante="acento"
                          onClick={() => activar(v.id)}
                          cargando={ocupado === v.id}
                          disabled={faltan > 0}
                          title={faltan > 0 ? `Faltan ${faltan} fotografías` : undefined}
                        >
                          Publicar
                        </Boton>
                      ) : null}

                      <Boton
                        variante="secundario"
                        onClick={() => navegar(`/editar/${v.id}`)}
                        disabled={ocupado === v.id}
                      >
                        Editar
                      </Boton>

                      <Boton
                        variante="fantasma"
                        onClick={() => setConfirmando(v)}
                        disabled={ocupado === v.id}
                      >
                        Eliminar
                      </Boton>
                    </div>

                    {confirmando?.id === v.id && (
                      <div className="mis-publicacion__confirmar" role="alertdialog">
                        <p>
                          ¿Eliminar <strong>{v.marca} {v.modelo}</strong>? Se borrarán también sus
                          fotos y las pujas registradas. No se puede deshacer.
                        </p>
                        <div className="mis-publicacion__confirmar-botones">
                          <Boton
                            variante="peligro"
                            onClick={() => eliminar(v)}
                            cargando={ocupado === v.id}
                          >
                            Sí, eliminar
                          </Boton>
                          <Boton variante="fantasma" onClick={() => setConfirmando(null)}>
                            Cancelar
                          </Boton>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}