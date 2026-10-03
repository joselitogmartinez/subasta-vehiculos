import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FormularioVehiculo from '../components/FormularioVehiculo'
import SelectorFotos from '../components/SelectorFotos'
import { Alerta, Boton } from '../components/ui'
import { useAuth } from '../context/authContexto'
import { supabase } from '../lib/supabase'
import { cargarCatalogos } from '../lib/catalogos'
import { MINIMO_FOTOS, faltanFotos, registrarFotos, subirFotos } from '../lib/galeria'
import { mensajeDeError } from '../lib/formato'
import { validarVehiculo } from '../lib/validacion'
import '../styles/publicar.css'

const HORA = 3600 * 1000
const DIA = 24 * HORA

/** Valores iniciales: la subasta abre en una hora y dura siete dias. */
function valoresIniciales() {
  const inicio = new Date(Date.now() + HORA)
  const cierre = new Date(Date.now() + 7 * DIA)
  return {
    anio: new Date().getFullYear(),
    tipo_articulo: '',
    marca: '',
    modelo: '',
    motor: '',
    transmision: '',
    combustible: '',
    tren_manejo: '',
    num_cilindros: '',
    nivel_dano: 'verde',
    descripcion: '',
    monto_base: '',
    fecha_inicio: inicio.toISOString(),
    fecha_cierre: cierre.toISOString(),
  }
}

const PASOS = ['Datos del vehículo', 'Fotografías', 'Publicar']

export default function Publicar() {
  const navegar = useNavigate()
  const { usuario } = useAuth()

  const [valores, setValores] = useState(valoresIniciales)
  const [errores, setErrores] = useState({})
  const [fotos, setFotos] = useState([])
  const [catalogos, setCatalogos] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [avance, setAvance] = useState(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    let vigente = true
    cargarCatalogos(supabase)
      .then((datos) => vigente && setCatalogos(datos))
      .catch(() => {})
    return () => {
      vigente = false
    }
  }, [])

  const faltan = faltanFotos(fotos.length)

  const cambiar = (nuevos) => {
    setValores(nuevos)
    setErrores((prev) => {
      const copia = { ...prev }
      for (const clave of Object.keys(nuevos)) delete copia[clave]
      return copia
    })
  }

  const publicar = async (e) => {
    e.preventDefault()
    setError('')
    setAviso('')

    const problemas = validarVehiculo(valores)
    if (faltan > 0) problemas.fotos = `Faltan ${faltan} fotografías.`

    setErrores(problemas)
    if (Object.keys(problemas).length > 0) {
      setError('Revisa los campos marcados antes de publicar.')
      return
    }

    setEnviando(true)
    setAvance({ hechas: 0, total: fotos.length })
    let vehiculoId = null

    try {
      // 1. Se crea como borrador. Las fotos necesitan el id para armar la
      //    ruta en el bucket, y ademas asi nada aparece en el catalogo
      //    hasta que la galeria este completa.
      const { data: id, error: errVeh } = await supabase.rpc('fn_publicar_vehiculo', {
        p_datos: {
          ...valores,
          anio: Number(valores.anio),
          num_cilindros: Number(valores.num_cilindros),
          monto_base: Number(valores.monto_base),
        },
      })

      if (errVeh) throw errVeh
      vehiculoId = id

      // 2. Subida de la galeria al bucket.
      const { filas, fallidas } = await subirFotos(
        supabase,
        usuario.id,
        id,
        fotos,
        (hechas, total) => setAvance({ hechas, total }),
      )

      await registrarFotos(supabase, filas)

      // 3. El servidor exige 5+ fotos antes de exponerla en el catalogo.
      const { error: errActivar } = await supabase.rpc('fn_activar_vehiculo', {
        p_vehiculo_id: id,
      })
      if (errActivar) throw errActivar

      if (fallidas.length > 0) {
        setAviso(
          `${fallidas.length} imagen(es) no se pudieron subir: ${fallidas.map((f) => f.archivo).join(', ')}. El vehículo se publicó con el resto.`,
        )
      }

      navegar(`/vehiculo/${id}`, { replace: true })
    } catch (e) {
      setError(mensajeDeError(e))

      // Si el fallo ocurrio despues de crear el borrador, se intenta
      // borrar para no dejar una publicacion a medio hacer.
      if (vehiculoId) {
        await supabase.rpc('fn_eliminar_vehiculo', { p_vehiculo_id: vehiculoId })
      }
      setEnviando(false)
      setAvance(null)
    }
  }

  return (
    <div className="publicar">
      <header className="publicar__cabecera">
        <h1 className="publicar__titulo">Publicar un vehículo</h1>
        <p className="publicar__sub">
          Completa la ficha, sube al menos {MINIMO_FOTOS} fotografías y define el monto base.
          Tu vehículo aparecerá en el catálogo y podrá ofertarse en tiempo real.
        </p>

        <ol className="publicar__pasos">
          {PASOS.map((paso, i) => (
            <li key={paso} className="publicar__paso">
              <span className="publicar__paso-numero">{i + 1}</span>
              {paso}
            </li>
          ))}
        </ol>
      </header>

      {error && (
        <Alerta tono="error" titulo="No pudimos publicar el vehículo">
          {error}
        </Alerta>
      )}

      {aviso && <Alerta tono="aviso">{aviso}</Alerta>}

      <form className="publicar__form" onSubmit={publicar} noValidate>
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
            Galería de fotografías
            <span className={faltan === 0 ? 'publicar__ok' : 'publicar__pendiente'}>
              {faltan === 0
                ? `${fotos.length} de ${MINIMO_FOTOS} · completo`
                : `faltan ${faltan}`}
            </span>
          </h2>
          <p className="publicar__ayuda">
            La primera imagen será la portada en el catálogo. Sube al menos {MINIMO_FOTOS}{' '}
            fotografías: es requisito del enunciado y el servidor no publica el vehículo sin
            ellas.
          </p>

          <SelectorFotos
            fotos={[]}
            nuevas={fotos}
            onNuevas={setFotos}
            onQuitarNueva={(indice) => setFotos(fotos.filter((_, i) => i !== indice))}
            deshabilitado={enviando}
          />

          {errores.fotos && <p className="campo__error">{errores.fotos}</p>}
        </section>

        {avance && (
          <div className="publicar__progreso" role="status">
            <div className="publicar__progreso-barra">
              <span
                style={{ width: `${Math.round((avance.hechas / avance.total) * 100)}%` }}
              />
            </div>
            <p className="publicar__progreso-texto">
              Subiendo fotografías {avance.hechas} de {avance.total}...
            </p>
          </div>
        )}

        <footer className="publicar__acciones">
          <Boton variante="fantasma" onClick={() => navegar('/mis-publicaciones')} disabled={enviando}>
            Ver mis publicaciones
          </Boton>
          <Boton
            variante="acento"
            tamano="lg"
            type="submit"
            cargando={enviando}
            disabled={faltan > 0}
          >
            {enviando ? 'Publicando...' : 'Publicar vehículo'}
          </Boton>
        </footer>

        {faltan > 0 && !enviando && (
          <p className="publicar__aviso-minimo">
            Aún faltan {faltan} fotografía{faltan === 1 ? '' : 's'} para poder publicar.
          </p>
        )}
      </form>
    </div>
  )
}