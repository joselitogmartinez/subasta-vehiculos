/**
 * Galeria de fotos de un vehiculo.
 *
 * Estructura en el bucket: {user_id}/{vehiculo_id}/{NN}.ext
 * Los archivos siempre cuelgan de la carpeta del usuario, y eso lo
 * revisa la policy de Storage: nadie puede escribir fuera de su carpeta
 * aunque manipule la ruta desde el navegador.
 */

export const MINIMO_FOTOS = 5
export const MAXIMO_FOTOS = 12
export const TAMANO_MAXIMO = 10 * 1024 * 1024

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

const EXTENSIONES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }

/** Revisa un archivo antes de subirlo. Devuelve el motivo si no vale. */
export function revisarArchivo(archivo, cantidadActual = 0) {
  if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
    return `Formato no admitido. Usa JPG, PNG, WEBP o AVIF.`
  }
  if (archivo.size > TAMANO_MAXIMO) {
    const mb = (archivo.size / 1024 / 1024).toFixed(1)
    return `Pesa ${mb} MB y el máximo es 10 MB.`
  }
  if (archivo.size === 0) {
    return 'El archivo está vacío.'
  }
  if (cantidadActual >= MAXIMO_FOTOS) {
    return `El máximo es ${MAXIMO_FOTOS} fotografías.`
  }
  return null
}

/** Filtra una lista de archivos y separa los válidos de los rechazados. */
export function revisarSeleccion(archivos, cantidadActual = 0) {
  const aceptados = []
  const rechazados = []

  for (const archivo of archivos) {
    const problema = revisarArchivo(archivo, cantidadActual + aceptados.length)
    if (problema) rechazados.push({ archivo, problema })
    else aceptados.push(archivo)
  }

  return { aceptados, rechazados }
}

export function faltanFotos(cantidad) {
  return Math.max(0, MINIMO_FOTOS - cantidad)
}

/**
 * Sube las fotos al bucket y devuelve las filas para `fotos_vehiculo`.
 *
 * `ordenInicial` sirve al editar: las fotos nuevas se colocan despues de
 * las que ya existen en lugar de empezar de cero y pisar el orden.
 *
 * Se sube de a una para poder informar el avance y para no abortar toda
 * la operacion si un archivo falla: el resto ya quedo en el bucket y se
 * reporta igual.
 */
export async function subirFotos(
  cliente,
  usuarioId,
  vehiculoId,
  archivos,
  alAvanzar,
  ordenInicial = 0,
) {
  const filas = []
  const fallidas = []
  let hechas = 0

  for (const [indice, archivo] of archivos.entries()) {
    const posicion = ordenInicial + indice
    const extension = EXTENSIONES[archivo.type] ?? 'jpg'
    const ruta = `${usuarioId}/${vehiculoId}/${String(posicion + 1).padStart(2, '0')}.${extension}`

    try {
      const { error } = await cliente.storage
        .from('vehiculos')
        .upload(ruta, archivo, { contentType: archivo.type, upsert: true })

      if (error) throw new Error(error.message)

      const { data: publica } = cliente.storage.from('vehiculos').getPublicUrl(ruta)
      filas.push({
        vehiculo_id: vehiculoId,
        storage_path: ruta,
        url: publica.publicUrl,
        orden: posicion,
      })
    } catch (e) {
      fallidas.push({ archivo: archivo.name, problema: e.message })
    }

    hechas++
    alAvanzar?.(hechas, archivos.length)
  }

  return { filas, fallidas }
}

/** Registra en la base de datos las fotos ya subidas al bucket. */
export async function registrarFotos(cliente, filas) {
  if (filas.length === 0) return
  const { error } = await cliente.from('fotos_vehiculo').insert(filas)
  if (error) throw error
}

/**
 * Borra una foto: primero el archivo del bucket y despues la fila.
 * Al reves, quedaria un archivo huerfano que ocupa espacio para siempre.
 */
export async function eliminarFoto(cliente, foto) {
  if (foto.path) {
    const { error } = await cliente.storage.from('vehiculos').remove([foto.path])
    if (error) throw error
  }
  const { error } = await cliente.from('fotos_vehiculo').delete().eq('id', foto.id)
  if (error) throw error
}

/** Libera el espacio de un vehiculo que se elimina por completo. */
export async function limpiarArchivos(cliente, usuarioId, vehiculoId) {
  const carpeta = `${usuarioId}/${vehiculoId}`
  const { data } = await cliente.storage.from('vehiculos').list(carpeta, { limit: 100 })
  const rutas = (data ?? []).map((f) => `${carpeta}/${f.name}`)
  if (rutas.length === 0) return 0

  const { error } = await cliente.storage.from('vehiculos').remove(rutas)
  if (error) throw error
  return rutas.length
}

/** Renombra los archivos para que el orden coincida con el mostrado. */
export async function reordenarFotos(cliente, usuarioId, vehiculoId, fotos) {
  const filas = []

  for (const [indice, foto] of fotos.entries()) {
    const origen = foto.path
    const destino = `${usuarioId}/${vehiculoId}/${String(indice + 1).padStart(2, '0')}.${extensionDe(origen)}`

    if (origen !== destino) {
      const { error } = await cliente.storage.from('vehiculos').move(origen, destino)
      if (error) throw error
    }

    const nuevaUrl = cliente.storage.from('vehiculos').getPublicUrl(destino).data.publicUrl
    const { error } = await cliente
      .from('fotos_vehiculo')
      .update({ orden: indice, storage_path: destino, url: nuevaUrl })
      .eq('id', foto.id)

    if (error) throw error
    filas.push({ ...foto, orden: indice, path: destino, url: nuevaUrl })
  }

  return filas
}

const extensionDe = (ruta) => {
  const m = String(ruta).match(/\.([a-z0-9]+)$/i)
  return m ? m[1].toLowerCase() : 'jpg'
}