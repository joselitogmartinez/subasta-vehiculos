// Verifica los filtros multitarea del catalogo contra la base de datos
// real, usando exactamente la misma logica que corre en el navegador.
//
// Uso: npm run db:verify-filtros

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { consultarInventario, cargarCatalogos, contarPorEstado } from '../src/lib/catalogos.js'
import { FILTROS_VACIOS } from '../src/lib/filtros.js'

config({ path: '.env.local', quiet: true })

const anon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
})

const con = (extra) => ({ ...FILTROS_VACIOS, ...extra })
const nombres = (filas) => filas.map((f) => `${f.marca} ${f.modelo}`.slice(0, 26)).join(' | ')

const resultados = []
const check = (ok, nombre, detalle) => resultados.push({ ok: !!ok, nombre, detalle })

console.log('\n=== FASE 5 · Verificacion de filtros del catalogo ===\n')

const todo = await consultarInventario(anon, con({}))
check(todo.length > 0, 'sin filtros devuelve el catalogo', `${todo.length} vehiculos`)

// --------------------------------------------------------------- Catalogos
const catalogos = await cargarCatalogos(anon)
check(
  (catalogos?.marcas?.length ?? 0) > 1 && (catalogos?.anio_min ?? 0) > 1900,
  'catalogos para los desplegables',
  `${catalogos?.marcas?.length} marcas, ${catalogos?.modelos?.length} modelos, años ${catalogos?.anio_min}-${catalogos?.anio_max}`,
)

const TRENES_VALIDOS = ['AWD', 'FWD', 'RWD', '4WD']
const trenesFueraDeRango = (catalogos?.trenes ?? []).filter((t) => !TRENES_VALIDOS.includes(t))
check(
  trenesFueraDeRango.length === 0,
  'trenes de manejo dentro del catalogo del enunciado',
  (catalogos?.trenes ?? []).join(', '),
)

check(
  (catalogos?.trenes ?? []).length === 4,
  'los 4 trenes de manejo tienen datos',
  `presentes: ${(catalogos?.trenes ?? []).join(', ')}`,
)

/**
 * Invariante clave: todo valor que ofrece un desplegable debe devolver
 * resultados al filtrar por el. Si el desplegable ofrece "CHEVROLET" y el
 * filtro usa eq(marca, 'CHEVROLET') pero en la tabla esta "Chevrolet", el
 * desplegable ofrece una opcion muerta. Este bucle detecta toda la familia
 * de fallos de normalizacion, no solo el de marca.
 *
 * La clave de filtro no siempre coincide con el nombre de la columna:
 * el desplegable de tipos se llama "tipo" y el de trenes "tren", para no
 * chocar con las palabras reservadas.
 */
const CAMPOS_CATALOGO = [
  { catalogo: 'marcas', columna: 'marca', filtro: 'marca' },
  { catalogo: 'modelos', columna: 'modelo', filtro: 'modelo' },
  { catalogo: 'tipos', columna: 'tipo_articulo', filtro: 'tipo' },
  { catalogo: 'combustibles', columna: 'combustible', filtro: 'combustible' },
  { catalogo: 'transmisiones', columna: 'transmision', filtro: 'transmision' },
  { catalogo: 'trenes', columna: 'tren_manejo', filtro: 'tren' },
]

for (const { catalogo, columna, filtro } of CAMPOS_CATALOGO) {
  const valores = catalogos?.[catalogo] ?? []
  const sinResultados = []
  const conFugas = []

  for (const valor of valores) {
    const filtrado = await consultarInventario(anon, con({ [filtro]: valor }))
    if (filtrado.length === 0) sinResultados.push(valor)
    if (!filtrado.every((v) => v[columna] === valor)) conFugas.push(valor)
  }

  check(
    sinResultados.length === 0 && conFugas.length === 0,
    `desplegable "${catalogo}": cada opcion filtra`,
    sinResultados.length || conFugas.length
      ? `sin resultados: [${sinResultados}]` + (conFugas.length ? ` | devuelven otros: [${conFugas}]` : '')
      : `${valores.length} valores, todos devuelven resultados`,
  )
}

// -------------------------------------------------------------- Contadores
const conteo = await contarPorEstado(anon)
check(
  conteo.total === todo.length && conteo.activa > 0,
  'cifras del encabezado',
  `activa=${conteo.activa} programada=${conteo.programada} desierta=${conteo.desierta} vendida=${conteo.vendida}`,
)

// ---------------------------------------------------------------- Marca
const marca = catalogos.marcas[0]
const porMarca = await consultarInventario(anon, con({ marca }))
check(
  porMarca.length > 0 && porMarca.every((v) => v.marca === marca),
  'filtrar por marca',
  `${marca} -> ${porMarca.length} (${nombres(porMarca)})`,
)

// ---------------------------------------------------------------- Daño
const rojo = await consultarInventario(anon, con({ dano: 'rojo' }))
check(
  rojo.length > 0 && rojo.every((v) => v.nivel_dano === 'rojo'),
  'filtrar por nivel de daño',
  `rojo -> ${rojo.length} (${nombres(rojo)})`,
)

const verde = await consultarInventario(anon, con({ dano: 'verde' }))
check(
  verde.length > 0 && verde.every((v) => v.nivel_dano === 'verde'),
  'filtrar por daño verde',
  `verde -> ${verde.length}`,
)

// ------------------------------------------------------------- Rango año
const enRango = await consultarInventario(anon, con({ anioMin: 2020, anioMax: 2021 }))
check(
  enRango.length > 0 && enRango.every((v) => v.anio >= 2020 && v.anio <= 2021),
  'filtrar por rango de año',
  `2020-2021 -> ${enRango.length} (${nombres(enRango)})`,
)

// ------------------------------------------------------- Búsqueda libre
const texto = await consultarInventario(anon, con({ q: 'corolla' }))
check(
  texto.length > 0 &&
    texto.every((v) => `${v.marca} ${v.modelo}`.toLowerCase().includes('corolla')),
  'búsqueda libre en marca y modelo',
  `"corolla" -> ${texto.length} (${nombres(texto)})`,
)

const textoMayus = await consultarInventario(anon, con({ q: 'TOYOTA' }))
check(
  textoMayus.length > 0,
  'búsqueda libre sin distinguir mayúsculas',
  `"TOYOTA" -> ${textoMayus.length}`,
)

const textoIncierta = await consultarInventario(anon, con({ q: 'zzz-no-existe' }))
check(textoIncierta.length === 0, 'búsqueda sin resultados', `"zzz-no-existe" -> 0`)

// ------------------------------------------- Caracteres especiales (injection)
const conSimbolos = await consultarInventario(anon, con({ q: 'toyota,()%*\\' }))
check(
  Array.isArray(conSimbolos),
  'caracteres especiales no rompen la consulta',
  `${conSimbolos.length} resultados, sin error`,
)

// ------------------------------------------------------------ Combinados
// Los valores salen del catalogo, no escritos a mano: la vista normaliza
// a mayusculas y eq() distingue mayusculas de minusculas.
const [tipoAuto, combustibleAuto, trenFwd] = [
  catalogos.tipos.find((t) => t.includes('MÓVIL')),
  catalogos.combustibles[0],
  'FWD',
]

const combinado = await consultarInventario(
  anon,
  con({ tipo: tipoAuto, combustible: combustibleAuto, tren: trenFwd }),
)
check(
  combinado.length > 0 &&
    combinado.every(
      (v) => v.tipo_articulo === tipoAuto && v.combustible === combustibleAuto && v.tren_manejo === trenFwd,
    ),
  'tres filtros combinados a la vez',
  `${tipoAuto} + ${combustibleAuto} + ${trenFwd} -> ${combinado.length} (${nombres(combinado)})`,
)

const excluyente = await consultarInventario(
  anon,
  con({ marca: catalogos.marcas[0], dano: 'amarillo' }),
)
check(
  excluyente.every((v) => v.marca === catalogos.marcas[0] && v.nivel_dano === 'amarillo'),
  'combinación sin resultados no inventa datos',
  `${catalogos.marcas[0]} + amarillo -> ${excluyente.length}`,
)

// ---------------------------------------------------------------- Estado
for (const estado of ['activa', 'programada', 'vendida', 'desierta']) {
  const porEstado = await consultarInventario(anon, con({ estado }))
  check(
    porEstado.every((v) => v.estado_calculado === estado),
    `filtrar por estado: ${estado}`,
    `${porEstado.length} (${nombres(porEstado)})`,
  )
}

// --------------------------------------------------------------- Ordenes
const asc = await consultarInventario(anon, con({ orden: 'precio-asc' }))
const precios = asc.map((v) => Number(v.monto_base))
check(
  precios.every((p, i) => i === 0 || p >= precios[i - 1]),
  'orden por precio ascendente',
  `Q. ${precios[0].toLocaleString('es-GT')} primero`,
)

const desc = await consultarInventario(anon, con({ orden: 'precio-desc' }))
check(
  Number(desc[0].monto_base) === Math.max(...precios),
  'orden por precio descendente',
  `Q. ${Number(desc[0].monto_base).toLocaleString('es-GT')} primero`,
)

const anioDesc = await consultarInventario(anon, con({ orden: 'anio-desc' }))
check(
  Number(anioDesc[0].anio) === Math.max(...todo.map((v) => Number(v.anio))),
  'orden por año más nuevo',
  `${anioDesc[0].anio} primero`,
)

const urgente = await consultarInventario(anon, con({ orden: 'cierre-urgente', estado: 'activa' }))
const cierres = urgente.map((v) => new Date(v.fecha_cierre).getTime())
check(
  cierres.every((c, i) => i === 0 || c >= cierres[i - 1]),
  'orden por cierre más próximo',
  urgente.length > 0 ? `primero cierra ${new Date(urgente[0].fecha_cierre).toLocaleString('es-GT')}` : 'sin subastas activas',
)

// --------------------------------------------------- Anonimo solo lectura
const conBorrador = await consultarInventario(
  anon,
  con({ estado: 'programada' }),
)
check(
  conBorrador.length === conteo.programada,
  'el anónimo no ve publicaciones en borrador',
  `${conBorrador.length} programadas, ningun borrador`,
)

// ---------------------------------------------------------------- Informe
console.log('')
for (const r of resultados) {
  console.log(`  ${r.ok ? 'OK   ' : 'FALLA'} ${r.nombre.padEnd(40)} ${r.detalle}`)
}
const fallas = resultados.filter((r) => !r.ok).length
console.log(`\n  ${fallas === 0 ? 'TODO OK' : `${fallas} FALLA(S)`} · ${resultados.length} comprobaciones\n`)
process.exit(fallas === 0 ? 0 : 1)