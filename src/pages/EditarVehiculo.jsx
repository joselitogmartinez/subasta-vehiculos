import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import FormularioVehiculo from '../components/FormularioVehiculo'
import SelectorFotos from '../components/SelectorFotos'
import { Alerta, Boton, Cargando } from '../components/ui'
import { useAuth } from '../context/authContexto'
import { supabase } from '../lib/supabase'
import { cargarCatalogos } from '../lib/catalogos'
import {
  eliminarFoto,
  faltanFotos,
  registrarFotos,
  subirFotos,
} from '../lib/galeria'
import { mensajeDeError } from '../lib/formato'
import { validarVehiculo } from '../lib/validacion'
import '../styles/publicar.css'

export default function EditarVehiculo() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { usuario } = useAuth()

  const [vehiculo, setVehiculo] = useState(null)
  const [valores, setValores] = useState(null)
  const [errores, setErrores] = useState({})
  const [fotos, setFotos] = useState([])
  const [nuevas, setNuevas] = useState([])
  const [catalogos, setCatalogos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('vw_vehiculos').select('*').eq('id', id).maybeSingle()

    if (!data) {
      setError('No encontramos esta publicación. Puede que la hayas eliminado.')
      return
    }

    // es_mio lo calcula el servidor. Si es false, la policy de RLS igual
    // habria ocultado una publicacion ajena, pero el mensaje es explicito.
    if (!data.es_mio) {
      setError('Esta publicación no es tuya, así que no puedes editarla.')
      return
    }

    setVehiculo(data)
    setFotos(data.fotos ?? [])
    setValores({
      anio: data.anio,
      tipo_articulo: data.tipo_articulo,
      marca: data.marca,
      modelo: data.modelo,
      motor: data.motor,
      transmision: data.transmision,
      combustible: data.combustible,
      tren_manejo: data.tren_manejo,
      num_cilindros: data.num_cilindros,
      nivel_dano: data.nivel_dano,
      descripcion: data.descripcion ?? '',
      monto_base: Number(data.monto_base),
      fecha_inicio: data.fecha_inicio,
      fecha_cierre: data.fecha_cierre,
    })
  }, [id])

  useEffect(() => {
    let vigente = true

    // La IIFE awaits antes de tocar el estado: el setState cae en una
    // continuacion asincrona y no en este render.
    ;(async () => {
      await cargar()
      if (vigente) setCargando(false)
    })()

    return () => {
      vigente = false
    }
  }, [cargar])

  useEffect(() => {
    let vigente = true
    cargarCatalogos(supabase)
      .then((datos) => vigente && setCatalogos(datos))
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [])

  const cambiar = (nuevos) => {
    setValores(nuevos)
    setErrores((prev) => {
      const copia = { ...prev }
      for (const clave of Object.keys(nuevos)) delete copia[clave]
      return copia
    })
  }

  const quitarFoto = async (indice) => {
    const foto = fotos[indice]
    setFotos(fotos.filter((_, i) => i !== indice))
    try {
      await eliminarFoto(supabase, foto)
    } catch (e) {
      // Si el archivo se borro pero la fila no (o al reves), se recarga
      // desde el servidor para mostrar el estado real.
      setError(`No pudimos quitar la foto: ${e.message}`)
      await cargar()
    }
  }

  const moverFoto = async (indice, destino) => {
    const copia = [...fotos]
    const [movida] = copia.splice(indice, 1)
    copia.splice(destino, 0, movida)
    setFotos(copia)

    const { error: err } = await supabase
      .from('fotos_vehiculo')
      .update({ orden: destino })
      .eq('id', movida.id)
    if (err) {
      setError('No pudimos cambiar el orden de las fotos.')
      await cargar()
    }
  }

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    setExito('')

    const problemas = validarVehiculo(valores)

    // Un vehiculo ya publicado no puede quedar con menos de 5 fotos.
    const totalFotos = fotos.length + nuevas.length
    if (vehiculo.estado === 'activo' && totalFotos < 5) {
      problemas.fotos = `Un vehículo publicado necesita al menos 5 fotografías. Tienes ${totalFotos}.`
    }

    setErrores(problemas)
    if (Object.keys(problemas).length > 0) {
      setError('Revisa los campos marcados antes de guardar.')
      return
    }

    setEnviando(true)

    try {
      const { error: err } = await supabase.rpc('fn_actualizar_vehiculo', {
        p_vehiculo_id: id,
        p_datos: {
          ...valores,
          anio: Number(valores.anio),
          num_cilindros: Number(valores.num_cilindros),
          monto_base: Number(valores.monto_base),
        },
      })
      if (err) throw err

      if (nuevas.length > 0) {
        // Las nuevas ocupan los ultimos lugares del orden. Se pasan los
        // File tal cual: extenderlos con {...archivo} daria un objeto
        // vacio, porque name/type/size son getters del prototipo.
        const base = fotos.length
        const { filas } = await subirFotos(
          supabase,
          usuario.id,
          id,
          nuevas,
          null,
          base,
        )
        await registrarFotos(supabase, filas)
      }

      await cargar()
      setNuevas([])
      setExito('Cambios guardados.')
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setEnviando(false)
    }
  }

  const publicarBorrador = async () => {
    setEnviando(true)
    setError('')
    try {
      const { error: err } = await supabase.rpc('fn_activar_vehiculo', { p_vehiculo_id: id })
      if (err) throw err
      navegar(`/vehiculo/${id}`)
    } catch (e) {
      setError(mensajeDeError(e))
      setEnviando(false)
    }
  }

  if (cargando) {
    return (
      <div className="publicar">
        <Cargando texto="Cargando la publicación..." />
      </div>
    )
  }

  if (!valores) {
    return (
      <div className="publicar">
        <Alerta tono="error" titulo="No se puede editar">
          {error}
        </Alerta>
        <p>
          <Link to="/mis-publicaciones">Volver a mis publicaciones</Link>
        </p>
      </div>
    )
  }

  const totalFotos = fotos.length + nuevas.length
  const congelado = (vehiculo?.total_pujas ?? 0) > 0

  return (
    <div className="publicar">
      <nav className="detalle__miga" aria-label="Ruta de navegación">
        <Link to="/mis-publicaciones">Mis publicaciones</Link>
        <span aria-hidden="true">/</span>
        <span>
          {valores.marca} {valores.modelo}
        </span>
      </nav>

      <header className="publicar__cabecera">
        <h1 className="publicar__titulo">Editar publicación</h1>
        <p className="publicar__sub">
          Los cambios se reflejan en el catálogo al instante.
          {congelado &&
            ' Esta subasta ya tiene ofertas, así que el monto base y las fechas están congelados.'}
        </p>
      </header>

      {error && (
        <Alerta tono="error" titulo="No pudimos guardar los cambios">
          {error}
        </Alerta>
      )}
      {exito && <Alerta tono="exito">{exito}</Alerta>}

      <form className="publicar__form" onSubmit={guardar} noValidate>
        <section className="publicar__bloque">
          <FormularioVehiculo
            valores={valores}
            errores={errores}
            onCambio={cambiar}
            catalogos={catalogos}
            disabled={enviando}
          />
        </section>

        <section className="publicar__bloque">
          <h2 className="publicar__bloque-titulo">
            Galería
            <span
              className={
                totalFotos < 5 ? 'publicar__pendiente' : 'publicar__ok'
              }
            >
              {totalFotos} de 5 · mínimo{' '}
              {faltanFotos(totalFotos) === 0 ? 'cumplido' : `faltan ${faltanFotos(totalFotos)}`}
            </span>
          </h2>
          <p className="publicar__ayuda">
            La primera foto es la portada del catálogo. Puedes quitar fotos o cambiar su
            orden con las flechas.
          </p>

          <SelectorFotos
            fotos={fotos}
            nuevas={nuevas}
            onNuevas={setNuevas}
            onQuitarNueva={(i) => setNuevas(nuevas.filter((_, k) => k !== i))}
            onQuitarExistente={quitarFoto}
            onMover={moverFoto}
            deshabilitado={enviando}
          />

          {errores.fotos && <p className="campo__error">{errores.fotos}</p>}
        </section>

        <footer className="publicar__acciones">
          <Boton variante="fantasma" onClick={() => navegar('/mis-publicaciones')} disabled={enviando}>
            Cancelar
          </Boton>

          {vehiculo.estado === 'borrador' && (
            <Boton
              variante="secundario"
              onClick={publicarBorrador}
              cargando={enviando}
              disabled={faltanFotos(totalFotos) > 0}
              title={faltanFotos(totalFotos) > 0 ? 'Carga al menos 5 fotografías' : undefined}
            >
              Guardar y publicar
            </Boton>
          )}

          <Boton variante="acento" tamano="lg" type="submit" cargando={enviando}>
            {enviando ? 'Guardando...' : 'Guardar cambios'}
          </Boton>
        </footer>
      </form>
    </div>
  )
}