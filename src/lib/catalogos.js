/**
 * Consultas del catalogo.
 *
 * El cliente de Supabase se recibe como parametro en vez de importarse.
 * Asi este modulo no depende de `import.meta.env` y se puede ejercitar
 * desde Node (scripts/verify-filtros.mjs) con un cliente creado a mano,
 * contra exactamente la misma logica que usa el navegador.
 *
 * Ademas, todo se resuelve con filtros del servidor sobre la vista
 * `vw_inventario`, no descargando el catalogo completo y filtrando en el
 * navegador. Con la flota de demostracion la diferencia no se nota, pero
 * con miles de vehiculos seria la diferencia entre una pagina que carga
 * y otra que no.
 */

// PostgREST usa sintaxis propia en `.or()`, y algunos caracteres rompen
// el filtro. Se limpian en vez de intentar escaparlos.
const limpiar = (valor) => valor.replace(/[,()%*\\]/g, ' ').replace(/\s+/g, ' ').trim()

export async function cargarCatalogos(cliente) {
  const { data, error } = await cliente.from('vw_catalogos').select('*').maybeSingle()
  if (error) throw error
  return data
}

export async function consultarInventario(cliente, filtros) {
  let consulta = cliente.from('vw_inventario').select('*')

  const texto = limpiar(filtros.q ?? '')
  if (texto) {
    consulta = consulta.or(`marca.ilike.%${texto}%,modelo.ilike.%${texto}%`)
  }

  if (filtros.anioMin) consulta = consulta.gte('anio', Number(filtros.anioMin))
  if (filtros.anioMax) consulta = consulta.lte('anio', Number(filtros.anioMax))
  if (filtros.marca) consulta = consulta.eq('marca', filtros.marca)
  if (filtros.modelo) consulta = consulta.eq('modelo', filtros.modelo)
  if (filtros.tipo) consulta = consulta.eq('tipo_articulo', filtros.tipo)
  if (filtros.combustible) consulta = consulta.eq('combustible', filtros.combustible)
  if (filtros.transmision) consulta = consulta.eq('transmision', filtros.transmision)
  if (filtros.tren) consulta = consulta.eq('tren_manejo', filtros.tren)
  if (filtros.cilindros) consulta = consulta.eq('num_cilindros', Number(filtros.cilindros))
  if (filtros.dano) consulta = consulta.eq('nivel_dano', filtros.dano)
  if (filtros.estado) consulta = consulta.eq('estado_calculado', filtros.estado)

  switch (filtros.orden) {
    case 'cierre-urgente':
      consulta = consulta.order('fecha_cierre', { ascending: true })
      break
    case 'precio-asc':
      consulta = consulta.order('monto_base', { ascending: true })
      break
    case 'precio-desc':
      consulta = consulta.order('monto_base', { ascending: false })
      break
    case 'anio-desc':
      consulta = consulta.order('anio', { ascending: false })
      break
    default:
      consulta = consulta.order('creado_en', { ascending: false })
  }

  const { data, error } = await consulta

  if (error) throw error
  return data ?? []
}

/** Numero de vehiculos por estado, para las cifras del encabezado. */
export async function contarPorEstado(cliente) {
  const { data, error } = await cliente.from('vw_inventario').select('estado_calculado, id')

  if (error) throw error

  const conteo = { activa: 0, programada: 0, desierta: 0, vendida: 0, total: data?.length ?? 0 }
  for (const fila of data ?? []) {
    if (conteo[fila.estado_calculado] !== undefined) conteo[fila.estado_calculado]++
  }
  return conteo
}