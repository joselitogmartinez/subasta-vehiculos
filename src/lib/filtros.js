// Estado de los filtros del catalogo y su correspondencia con la URL.
//
// Los filtros viven en los query params de la URL, no en un useState
// suelto. Asi una busqueda se puede compartir por enlace, el boton
// "atras" del navegador funciona, y recargar no pierde la seleccion.

export const FILTROS_VACIOS = {
  q: '',
  anioMin: '',
  anioMax: '',
  marca: '',
  modelo: '',
  tipo: '',
  combustible: '',
  transmision: '',
  tren: '',
  cilindros: '',
  dano: '',
  estado: '',
  orden: 'recientes',
}

export const ORDENES = [
  { valor: 'recientes', texto: 'Mas recientes' },
  { valor: 'cierre-urgente', texto: 'Cierran primero' },
  { valor: 'precio-asc', texto: 'Precio: menor a mayor' },
  { valor: 'precio-desc', texto: 'Precio: mayor a menor' },
  { valor: 'anio-desc', texto: 'Anio: mas nuevo' },
]

// Filtros que se comparan contra una opcion de un desplegable.
const TEXTO = ['marca', 'modelo', 'tipo', 'combustible', 'transmision', 'tren', 'dano', 'estado']

export function filtrosDesdeParams(params) {
  const filtros = { ...FILTROS_VACIOS }

  for (const clave of TEXTO) filtros[clave] = params.get(clave) ?? ''
  filtros.anioMin = params.get('anioMin') ?? ''
  filtros.anioMax = params.get('anioMax') ?? ''
  filtros.orden = params.get('orden') ?? FILTROS_VACIOS.orden

  return filtros
}

export function paramsDesdeFiltros(filtros) {
  const params = new URLSearchParams()
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor && valor !== FILTROS_VACIOS[clave]) params.set(clave, valor)
  }
  return params
}

/** Cuantos filtros hay aplicados, para el badge del boton en movil. */
export function contarFiltros(filtros) {
  return Object.entries(filtros).filter(
    ([clave, valor]) => clave !== 'orden' && valor && valor !== FILTROS_VACIOS[clave],
  ).length
}

/** Copia con todos los filtros vacios (el orden no cuenta como filtro). */
export function limpiarFiltros(filtros) {
  return { ...FILTROS_VACIOS, orden: filtros.orden }
}