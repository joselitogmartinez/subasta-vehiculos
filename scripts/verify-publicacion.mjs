// Verifica el flujo de publicacion de punta a punta: crear borrador,
// exigir 5+ fotos, publicar, editar y eliminar. Es el criterio S2.1.
//
// Trabaja con un vehiculo de prueba que se borra al terminar.
//
// Uso: npm run db:verify-publicacion

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { limpiarArchivos } from '../src/lib/galeria.js'

config({ path: '.env.local', quiet: true })

const URL_SUPABASE = process.env.VITE_SUPABASE_URL
const PUBLISHABLE = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const SECRET = process.env.SUPABASE_SECRET_KEY
const BUCKET = 'vehiculos'

const admin = createClient(URL_SUPABASE, SECRET, { auth: { persistSession: false } })

// PNG de 1x1 en base64. Solo importa que sea un PNG valido: la
// validacion de la UI revisa tipo y tamano, no el contenido.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const resultados = []
const check = (ok, nombre, detalle) => resultados.push({ ok: !!ok, nombre, detalle })

async function sesion(correo, password) {
  const cliente = createClient(URL_SUPABASE, PUBLISHABLE, { auth: { persistSession: false } })
  const { data, error } = await cliente.auth.signInWithPassword({ email: correo, password })
  if (error) throw new Error(`sesion de ${correo}: ${error.message}`)
  return { cliente, userId: data.user.id }
}

const FICHA = {
  anio: 2021,
  tipo_articulo: 'Automóvil',
  marca: 'TEST',
  modelo: 'PUBLICACION',
  motor: '2.0L 4 cilindros',
  transmision: 'Automática',
  combustible: 'Gasolina',
  tren_manejo: 'FWD',
  num_cilindros: 4,
  nivel_dano: 'amarillo',
  descripcion: 'Vehiculo de prueba del script de verificacion.',
  monto_base: 30000,
  fecha_inicio: new Date(Date.now() - 3600e3).toISOString(),
  fecha_cierre: new Date(Date.now() + 7 * 86400e3).toISOString(),
}

console.log('\n=== FASE 7 · Verificacion del flujo de publicacion ===\n')

// Limpieza de rezagados de corridas anteriores.
const { data: rezagados } = await admin.from('vehiculos').select('id').eq('marca', 'TEST')
for (const v of rezagados ?? []) await admin.from('vehiculos').delete().eq('id', v.id)
if (rezagados?.length) console.log(`  ${rezagados.length} vehiculo(s) de prueba previo(s) eliminado(s)\n`)

const maria = await sesion('maria@subasta.com', 'Subasta2026!')
const carlos = await sesion('carlos@subasta.com', 'Subasta2026!')

// 1. Crear el borrador
const { data: idVehiculo, error: errCrear } = await maria.cliente.rpc('fn_publicar_vehiculo', {
  p_datos: FICHA,
})

check(
  !errCrear && !!idVehiculo,
  'crear la publicacion en borrador',
  errCrear?.message ?? `id ${idVehiculo.slice(0, 8)}`,
)

if (!idVehiculo) {
  for (const r of resultados) console.log(`  FALLA ${r.nombre}`)
  process.exit(1)
}

const id = idVehiculo

// El borrador no debe aparecer en el catalogo publico.
const { data: enCatalogo } = await createClient(URL_SUPABASE, PUBLISHABLE).from('vw_inventario').select('id').eq('id', id)
check(
  (enCatalogo ?? []).length === 0,
  'el borrador no aparece en el catalogo',
  'invisible para el publico mientras esta en borrador',
)

// 2. El minimo de 5 fotos
//
// Cada caso parte de cero. Si se acumaran las fotos entre intentos los
// conteos dejan de coincidir con lo que dice el caso y la prueba miente.
async function borrarTodasLasFotos() {
  const { data } = await maria.cliente.from('fotos_vehiculo').select('id').eq('vehiculo_id', id)
  for (const f of data ?? []) {
    await maria.cliente.from('fotos_vehiculo').delete().eq('id', f.id)
  }
  return (data ?? []).length
}

async function subirFotos(cantidad, desde = 0) {
  const filas = []
  for (let i = 0; i < cantidad; i++) {
    const n = desde + i + 1
    const ruta = `${maria.userId}/${id}/${String(n).padStart(2, '0')}.png`
    const { error: errUp } = await maria.cliente.storage
      .from(BUCKET)
      .upload(ruta, PNG_1X1, { contentType: 'image/png', upsert: true })
    if (errUp) throw new Error(`subida fallida: ${errUp.message}`)

    const { data: pub } = maria.cliente.storage.from(BUCKET).getPublicUrl(ruta)
    filas.push({ vehiculo_id: id, storage_path: ruta, url: pub.publicUrl, orden: n - 1 })
  }
  if (filas.length) {
    const { error: errIns } = await maria.cliente.from('fotos_vehiculo').insert(filas)
    if (errIns) throw new Error(`insercion fallida: ${errIns.message}`)
  }
}

async function intentarActivar() {
  const { error } = await maria.cliente.rpc('fn_activar_vehiculo', { p_vehiculo_id: id })
  return error?.message ?? null
}

await borrarTodasLasFotos()
let mensaje = await intentarActivar()
check(
  !!mensaje && /Llevas 0/i.test(mensaje),
  'no publica con 0 fotografias',
  mensaje ?? 'ACEPTO (error)',
)

for (const n of [1, 3, 4]) {
  await borrarTodasLasFotos()
  await subirFotos(n)
  mensaje = await intentarActivar()
  check(
    !!mensaje && new RegExp(`Llevas ${n}\\b`, 'i').test(mensaje),
    `no publica con ${n} foto${n === 1 ? '' : 's'}`,
    mensaje ?? `ACEPTO (error) con ${n}`,
  )
}

// 3. Quinta foto y publicacion
await subirFotos(1, 4)
mensaje = await intentarActivar()
check(mensaje === null, 'publica al llegar a 5 fotografias', mensaje ?? 'publicada')

const anon = createClient(URL_SUPABASE, PUBLISHABLE, { auth: { persistSession: false } })
const { data: ahoraSi } = await anon.from('vw_inventario').select('id, marca, estado_calculado').eq('id', id)
check(
  (ahoraSi ?? []).length === 1,
  'aparece en el catalogo publico',
  ahoraSi?.[0] ? `estado=${ahoraSi[0].estado_calculado}` : 'no aparece',
)

// El anonimo ve el vehiculo pero no puede tocarlo.
const { error: errAnonEdit } = await anon
  .from('vehiculos')
  .update({ monto_base: 1 })
  .eq('id', id)
check(!!errAnonEdit, 'el anonimo no puede editarlo', errAnonEdit?.code ?? 'PERMITIDO (error)')

// 4. Aislamiento entre usuarios
const { error: errAjeno } = await carlos.cliente.rpc('fn_actualizar_vehiculo', {
  p_vehiculo_id: id,
  p_datos: { ...FICHA, marca: 'ROBADO' },
})
check(!!errAjeno, 'otro usuario no puede editarlo', errAjeno?.message ?? 'PERMITIDO (error)')

const { error: errAjenoBorrar } = await carlos.cliente.rpc('fn_eliminar_vehiculo', {
  p_vehiculo_id: id,
})
check(!!errAjenoBorrar, 'otro usuario no puede eliminarlo', errAjenoBorrar?.message ?? 'PERMITIDO (error)')

// 5. Editar la ficha
const { error: errEditar } = await maria.cliente.rpc('fn_actualizar_vehiculo', {
  p_vehiculo_id: id,
  p_datos: {
    ...FICHA,
    descripcion: 'Descripcion editada por el script.',
    nivel_dano: 'rojo',
    monto_base: 30000,
  },
})
check(!errEditar, 'editar la ficha tecnica', errEditar?.message ?? 'guardado')

const { data: editada } = await anon
  .from('vw_vehiculos')
  .select('descripcion, nivel_dano, fotos')
  .eq('id', id)
  .single()
check(
  editada?.descripcion === 'Descripcion editada por el script.' && editada?.nivel_dano === 'rojo',
  'los cambios se ven en el catalogo',
  `nivel_dano=${editada?.nivel_dano}, fotos=${editada?.fotos?.length}`,
)

// 6. Con pujas, los parametros economicos se congelan
await admin.from('pujas').insert({ vehiculo_id: id, user_id: carlos.userId, monto: 30000 })

const { error: errCongelar } = await maria.cliente.rpc('fn_actualizar_vehiculo', {
  p_vehiculo_id: id,
  p_datos: { ...FICHA, monto_base: 90000 },
})
check(
  !!errCongelar && /ya hay pujas/i.test(errCongelar.message),
  'el monto base se congela si ya hay pujas',
  errCongelar?.message ?? 'PERMITIDO (error)',
)

const { error: errFichaOk } = await maria.cliente.rpc('fn_actualizar_vehiculo', {
  p_vehiculo_id: id,
  p_datos: { ...FICHA, monto_base: 30000, motor: '2.5L V6' },
})
check(!errFichaOk, 'la ficha si se puede editar con pujas', errFichaOk?.message ?? 'guardado')

// 7. Bajar de 5 fotos con el vehiculo ya publicado
//
// Se dejan 5 fotos y luego se quitan dos, para quedar en 3: por debajo
// del minimo. fn_actualizar_vehiculo debe reversar el cambio entero.
const { data: paraBorrar } = await maria.cliente
  .from('fotos_vehiculo')
  .select('id')
  .eq('vehiculo_id', id)
  .order('orden')
  .limit(2)

for (const f of paraBorrar ?? []) {
  await maria.cliente.from('fotos_vehiculo').delete().eq('id', f.id)
}

const { data: restantes } = await maria.cliente
  .from('fotos_vehiculo')
  .select('id')
  .eq('vehiculo_id', id)

const { error: errSinCinco } = await maria.cliente.rpc('fn_actualizar_vehiculo', {
  p_vehiculo_id: id,
  p_datos: { ...FICHA, monto_base: 30000 },
})
check(
  !!errSinCinco && /5 fotograf/i.test(errSinCinco.message),
  'un vehiculo publicado no puede quedar con menos de 5 fotos',
  errSinCinco?.message ?? `PERMITIDO (error), quedo con ${restantes?.length} fotos`,
)

// 8. Eliminar
const { error: errBorrar } = await maria.cliente.rpc('fn_eliminar_vehiculo', {
  p_vehiculo_id: id,
})
check(!errBorrar, 'eliminar la publicacion', errBorrar?.message ?? 'eliminada')

const { data: despues } = await anon.from('vw_inventario').select('id').eq('id', id)
check((despues ?? []).length === 0, 'desaparece del catalogo', 'ya no esta visible')

const { data: filasTras } = await admin
  .from('fotos_vehiculo')
  .select('id')
  .eq('vehiculo_id', id)
check(
  (filasTras ?? []).length === 0,
  'las filas de fotos caen en cascada',
  `${(filasTras ?? []).length} filas restantes`,
)

// Borrar la fila NO borra el archivo del bucket: eso lo hace la API de
// Storage desde el cliente, mediante limpiarArchivos. Se comprueba aqui
// la misma funcion que usa la interfaz.
const { data: antes } = await admin.storage.from(BUCKET).list(`${maria.userId}/${id}`, { limit: 100 })
const borrados = await limpiarArchivos(maria.cliente, maria.userId, id)
const { data: despuesArchivos } = await admin.storage
  .from(BUCKET)
  .list(`${maria.userId}/${id}`, { limit: 100 })

check(
  (antes ?? []).length > 0 && (despuesArchivos ?? []).length === 0,
  'limpiarArchivos vacia el bucket del vehiculo',
  `${(antes ?? []).length} archivos -> ${borrados} borrados -> ${(despuesArchivos ?? []).length} restantes`,
)

console.log('')
for (const r of resultados) {
  console.log(`  ${r.ok ? 'OK   ' : 'FALLA'} ${r.nombre.padEnd(48)} ${r.detalle}`)
}
const fallas = resultados.filter((r) => !r.ok).length
console.log(`\n  ${fallas === 0 ? 'TODO OK' : `${fallas} FALLA(S)`} · ${resultados.length} comprobaciones\n`)
process.exit(fallas === 0 ? 0 : 1)