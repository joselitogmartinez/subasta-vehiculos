import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Carrusel from '../components/Carrusel'
import PanelPuja from '../components/PanelPuja'
import Temporizador, { CuentaApertura } from '../components/Temporizador'
import { Badge, Boton, Cargando } from '../components/ui'
import { useAuth } from '../context/authContexto'
import { supabase } from '../lib/supabase'
import { useSubastaEnVivo } from '../lib/realtime'
import { borrarMiOferta, leerMiOferta } from '../lib/subasta'
import { etiquetaDano, etiquetaEstado, numero } from '../lib/formato'
import '../styles/detalle.css'

export default function DetalleVehiculo() {
  const { id } = useParams()

  // La `key` remonta todo el subarbol al cambiar de vehiculo. Asi el
  // estado arranca limpio sin efectos que lo reinicien a mano, y el
  // carrusel vuelve a su primera foto.
  return <DetalleVehiculoInterno key={id} id={id} />
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function DetalleVehiculoInterno({ id }) {
  const { usuario, autenticado } = useAuth()

  // Un id con formato invalido hace que Postgres responda
  // "invalid input syntax for type uuid", y ese error tecnico se
  // terminaba mostrando al visitante. Se comprueba antes de consultar
  // para que una URL mal escrita caiga en el aviso normal.
  const idInvalido = !UUID.test(id ?? '')

  const [vehiculo, setVehiculo] = useState(null)
  const [estado, setEstado] = useState(null)
  const usuarioId = usuario?.id ?? null

  // Lo que quedo guardado localmente se lee al montar, para pintar el
  // estado sin parpadeo. fn_estado_subasta lo confirma despues.
  const [miOferta, setMiOferta] = useState(() =>
    UUID.test(id ?? '') ? leerMiOferta(id, usuarioId) : null,
  )

  const [cargando, setCargando] = useState(!idInvalido)
  const [error, setError] = useState('')
  const [noEncontrado, setNoEncontrado] = useState(idInvalido)

  // ------------------------------------------------------------ Carga
  useEffect(() => {
    if (idInvalido) return

    let vigente = true

    async function cargar() {
      const { data, error: errVeh } = await supabase
        .from('vw_vehiculos')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (!vigente) return

      if (errVeh) {
        setError(errVeh.message)
        setCargando(false)
        return
      }

      if (!data) {
        setNoEncontrado(true)
        setCargando(false)
        return
      }

      setVehiculo(data)
      setEstado({
        estado: data.estado_calculado,
        monto_base: data.monto_base,
        monto_actual: data.monto_actual,
        total_pujas: data.total_pujas,
        monto_minimo: data.monto_minimo,
        fecha_inicio: data.fecha_inicio,
        fecha_cierre: data.fecha_cierre,
      })

      // La vista ya trae lo basico. fn_estado_subasta agrega el dato
      // personal: si el visitante tiene alguna oferta en esta subasta.
      const { data: personal } = await supabase.rpc('fn_estado_subasta', {
        p_vehiculo_id: id,
      })
      if (!vigente) return

      if (personal) {
        setEstado((prev) => ({ ...prev, ...personal }))
        if (personal.mi_oferta != null) {
          setMiOferta(Number(personal.mi_oferta))
        }
      }

      setCargando(false)
    }

    cargar()
    return () => {
      vigente = false
    }
  }, [id, idInvalido])

  // --------------------------------------------------- Tiempo real
  const alCambiar = useCallback((payload) => {
    setEstado((prev) => ({
      ...(prev ?? {}),
      monto_actual: Number(payload.monto_actual),
      total_pujas: Number(payload.total_pujas),
      monto_minimo: Number(payload.monto_minimo ?? prev?.monto_minimo ?? 0),
      estado: payload.estado ?? prev?.estado,
    }))
  }, [])

  const conectado = useSubastaEnVivo(id, alCambiar)

  // ------------------------------------------------------------ Ofertar
  const ofertar = useCallback(
    async (monto) => {
      const { error: err } = await supabase.rpc('fn_registrar_puja', {
        p_vehiculo_id: id,
        p_monto: monto,
      })
      if (err) throw err
    },
    [id],
  )

  const ficha = useMemo(() => {
    if (!vehiculo) return []
    return [
      ['Año', vehiculo.anio],
      ['Tipo', vehiculo.tipo_articulo],
      ['Marca', vehiculo.marca],
      ['Modelo', vehiculo.modelo],
      ['Motor', vehiculo.motor],
      ['Transmisión', vehiculo.transmision],
      ['Combustible', vehiculo.combustible],
      ['Tren de manejo', vehiculo.tren_manejo],
      ['Cilindros', vehiculo.num_cilindros],
      ['Nivel de daño', etiquetaDano(vehiculo.nivel_dano).texto],
    ]
  }, [vehiculo])

  if (cargando) {
    return (
      <div className="detalle">
        <Cargando texto="Cargando la subasta..." />
      </div>
    )
  }

  if (noEncontrado) {
    return (
      <div className="detalle">
        <div className="detalle__no-encontrado">
          <span aria-hidden="true">🔎</span>
          <h1>Vehiculo no disponible</h1>
          <p>Esta publicacion no existe o todavia no ha sido publicada.</p>
          <Link className="btn btn--primario" to="/">
            Ver el catalogo
          </Link>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="detalle">
        <div className="alerta alerta--error">
          <strong className="alerta__titulo">No pudimos cargar este vehiculo</strong>
          <span className="alerta__texto">{error}</span>
        </div>
      </div>
    )
  }

  const estadoActual = etiquetaEstado(estado.estado)

  return (
    <div className="detalle">
      <nav className="detalle__miga" aria-label="Ruta de navegacion">
        <Link to="/">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span>
          {vehiculo.marca} {vehiculo.modelo}
        </span>
      </nav>

      <div className="detalle__disposicion">
        <div className="detalle__principal">
          <Carrusel key={vehiculo.id} fotos={vehiculo.fotos} alt={`${vehiculo.marca} ${vehiculo.modelo}`} />

          <div className="detalle__titulos">
            <div className="detalle__titulos-linea">
              <h1 className="detalle__titulo">
                {vehiculo.marca} {vehiculo.modelo}
              </h1>
              <Badge tono={estadoActual.tono} punto={estado.estado === 'activa'}>
                {estadoActual.texto}
              </Badge>
            </div>
            <p className="detalle__subtitulo">
              {vehiculo.anio} · {vehiculo.tipo_articulo} · {vehiculo.combustible} ·{' '}
              {vehiculo.tren_manejo}
            </p>
          </div>

          {estado.estado === 'programada' ? (
            <CuentaApertura fechaInicio={vehiculo.fecha_inicio} />
          ) : (
            <Temporizador fechaCierre={vehiculo.fecha_cierre} />
          )}

          {vehiculo.descripcion && (
            <section className="detalle__bloque">
              <h2 className="detalle__bloque-titulo">Descripción</h2>
              <p className="detalle__descripcion">{vehiculo.descripcion}</p>
            </section>
          )}

          <section className="detalle__bloque">
            <h2 className="detalle__bloque-titulo">Ficha técnica</h2>
            <dl className="ficha">
              {ficha.map(([clave, valor]) => (
                <div className="ficha__celda" key={clave}>
                  <dt>{clave}</dt>
                  <dd>{valor}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="detalle__bloque">
            <h2 className="detalle__bloque-titulo">
              Galería ({numero(vehiculo.fotos?.length ?? 0)} fotografías)
            </h2>
            <p className="detalle__nota-privacidad">
              Las ofertas son anonimas. Solo se muestra el monto de la mejor oferta, nunca
              quien la realizo.
            </p>
          </section>
        </div>

        <aside className="detalle__lateral">
          <PanelPuja
            vehiculo={vehiculo}
            estado={estado}
            miOferta={miOferta}
            autenticado={autenticado}
            usuarioId={usuarioId}
            esMio={vehiculo.es_mio}
            conectado={conectado}
            alOfertar={ofertar}
          />

          {vehiculo.es_mio && (
            <Boton variante="fantasma" ancho onClick={() => borrarMiOferta(id, usuarioId)}>
              Restablecer mi marcador local
            </Boton>
          )}
        </aside>
      </div>
    </div>
  )
}