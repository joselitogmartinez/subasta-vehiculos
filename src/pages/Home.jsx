import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PanelFiltros from '../components/PanelFiltros'
import TarjetaVehiculo from '../components/TarjetaVehiculo'
import { Boton, Cargando, Vacio } from '../components/ui'
import { useAuth } from '../context/authContexto'
import { supabase } from '../lib/supabase'
import { cargarCatalogos, consultarInventario, contarPorEstado } from '../lib/catalogos'
import { contarFiltros, filtrosDesdeParams, paramsDesdeFiltros } from '../lib/filtros'
import { numero } from '../lib/formato'
import '../styles/home.css'

export default function Home() {
  const [params, setParams] = useSearchParams()
  const { autenticado } = useAuth()

  const filtros = useMemo(() => filtrosDesdeParams(params), [params])

  // Identidad de la consulta en curso. `cargando` se deriva de comparar
  // la clave pedida con la clave respondida, en lugar de poner un
  // setState dentro del efecto: eso provocaba un render extra y un
  // parpadeo en cada tecleo del buscador.
  const clave = useMemo(() => JSON.stringify(filtros), [filtros])

  const [resultado, setResultado] = useState({ clave: '', datos: [], error: '' })
  const [catalogos, setCatalogos] = useState(null)
  const [conteo, setConteo] = useState(null)
  const [panelAbierto, setPanelAbierto] = useState(false)

  const vehiculos = resultado.clave === clave ? resultado.datos : []
  const error = resultado.clave === clave ? resultado.error : ''
  const cargando = resultado.clave !== clave

  const filtrosActivos = contarFiltros(filtros)

  // Catálogos y cifras: cambian muy rara vez, no dependen de los filtros.
  useEffect(() => {
    let vigente = true

    cargarCatalogos(supabase)
      .then((datos) => vigente && setCatalogos(datos))
      .catch(() => {})
    contarPorEstado(supabase)
      .then((datos) => vigente && setConteo(datos))
      .catch(() => {})

    return () => {
      vigente = false
    }
  }, [])

  // Catálogo filtrado. La respuesta se descarta si llegó tarde.
  useEffect(() => {
    let vigente = true

    consultarInventario(supabase, filtros)
      .then((datos) => {
        if (vigente) setResultado({ clave, datos, error: '' })
      })
      .catch((e) => {
        if (vigente) setResultado({ clave, datos: [], error: e.message })
      })

    return () => {
      vigente = false
    }
  }, [clave, filtros])

  // Escribir los filtros en la URL es lo que hace que la búsqueda se
  // pueda compartir y que el botón "atrás" del navegador funcione.
  const onCambio = useCallback(
    (nuevos) => {
      setParams(paramsDesdeFiltros(nuevos), { replace: true })
    },
    [setParams],
  )

  const onLimpiar = useCallback(() => {
    setParams(new URLSearchParams(), { replace: true })
  }, [setParams])

  const cerrarPanel = () => setPanelAbierto(false)

  return (
    <>
      <section className="hero">
        <div className="hero__interior">
          <div className="hero__texto">
            <span className="hero__insignia">Subastas de vehiculos en tiempo real</span>
            <h1 className="hero__titulo">
              Puja en vivo por el vehiculo
              <br />
              que siempre quisiste
            </h1>
            <p className="hero__lema">
              Cada oferta se actualiza al instante para todos los conectados. Explora el
              inventario y filtra por lo que buscas. Los postores son anonimos: solo ves el
              monto, nunca quien ofrecio.
            </p>
            <div className="hero__acciones">
              <a className="btn btn--acento btn--lg" href="#catalogo">
                Ver vehiculos
              </a>
              {autenticado ? (
                <Link className="btn btn--secundario btn--lg" to="/publicar">
                  Publicar mi vehiculo
                </Link>
              ) : (
                <Link className="btn btn--secundario btn--lg" to="/registro">
                  Crear cuenta gratis
                </Link>
              )}
            </div>
          </div>

          <dl className="hero__cifras">
            <div className="hero__cifra">
              <dt>En vivo ahora</dt>
              <dd className="hero__cifra-numero">{conteo ? numero(conteo.activa) : '—'}</dd>
            </div>
            <div className="hero__cifra">
              <dt>Por abrir</dt>
              <dd className="hero__cifra-numero">{conteo ? numero(conteo.programada) : '—'}</dd>
            </div>
            <div className="hero__cifra">
              <dt>Vendidas</dt>
              <dd className="hero__cifra-numero">{conteo ? numero(conteo.vendida) : '—'}</dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="catalogo" id="catalogo">
        <div className="catalogo__interior">
          <div className="catalogo__barra">
            <div>
              <h2 className="catalogo__titulo">Vehiculos en subasta</h2>
              <p className="catalogo__conteo">
                {cargando
                  ? 'Buscando vehiculos...'
                  : `${numero(vehiculos.length)} ${vehiculos.length === 1 ? 'vehiculo' : 'vehiculos'}${filtrosActivos > 0 ? ' coinciden con tu busqueda' : ' disponibles'}`}
              </p>
            </div>

            <button
              type="button"
              className="catalogo__filtros-boton"
              onClick={() => setPanelAbierto(true)}
            >
              Filtros
              {filtrosActivos > 0 && <span className="catalogo__filtros-contador">{filtrosActivos}</span>}
            </button>
          </div>

          <div className="catalogo__disposicion">
            <PanelFiltros
              filtros={filtros}
              onCambio={onCambio}
              onLimpiar={onLimpiar}
              catalogos={catalogos}
              abierta={panelAbierto}
              onCerrar={cerrarPanel}
            />

            {panelAbierto && (
              <div className="filtros__velo" onClick={cerrarPanel} aria-hidden="true" />
            )}

            <div className="catalogo__resultados">
              {error && (
                <div className="alerta alerta--error">
                  <strong className="alerta__titulo">No pudimos cargar el catalogo</strong>
                  <span className="alerta__texto">{error}</span>
                </div>
              )}

              {cargando && vehiculos.length === 0 && <Cargando texto="Cargando inventario..." />}

              {!cargando && vehiculos.length === 0 && !error && (
                <Vacio
                  titulo={filtrosActivos > 0 ? 'Sin resultados' : 'Todavia no hay subastas'}
                  accion={
                    filtrosActivos > 0 ? (
                      <Boton variante="secundario" onClick={onLimpiar}>
                        Limpiar filtros
                      </Boton>
                    ) : null
                  }
                >
                  {filtrosActivos > 0
                    ? 'Ningun vehiculo cumple con todos los filtros a la vez. Prueba quitando alguno.'
                    : 'Aun no hay vehiculos publicados. Se el primero en publicar el suyo.'}
                </Vacio>
              )}

              {vehiculos.length > 0 && (
                <div className={`rejilla ${cargando ? 'rejilla--cargando' : ''}`}>
                  {vehiculos.map((v) => (
                    <TarjetaVehiculo key={v.id} vehiculo={v} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}