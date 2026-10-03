// Verificacion de las reglas de subasta contra la base de datos real,
// usando sesiones autenticadas de los tres usuarios de prueba.
//
// Trabaja sobre un vehiculo temporal que se crea y se borra al final,
// para no ensuciar los vehiculos de demostracion.
//
// Uso: npm run db:verify-pujas

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local', quiet: true })

const URL_SUPABASE = process.env.VITE_SUPABASE_URL
const PUBLISHABLE = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const SECRET = process.env.SUPABASE_SECRET_KEY

const admin = createClient(URL_SUPABASE, SECRET, { auth: { persistSession: false } })

const CRED = {
  maria: { correo: 'maria@subasta.com', password: 'Subasta2026!' },
  carlos: { correo: 'carlos@subasta.com', password: 'Subasta2026!' },
  ana: { correo: 'ana@subasta.com', password: 'Subasta2026!' },
}

// Sesion independiente por usuario, con la MISMA publishable key que
// usa el navegador. Asi se prueba lo que vera el profesor.
async function sesion(correo, password) {
  const cliente = createClient(URL_SUPABASE, PUBLISHABLE, { auth: { persistSession: false } })
  const { data, error } = await cliente.auth.signInWithPassword({ email: correo, password })
  if (error) throw new Error(`No se pudo iniciar sesion como ${correo}: ${error.message}`)
  return { cliente, userId: data.user.id }
}

const anon = createClient(URL_SUPABASE, PUBLISHABLE, { auth: { persistSession: false } })

const resultados = []
const check = (ok, nombre, detalle) => {
  resultados.push({ ok: !!ok, nombre, detalle })
  return !!ok
}

console.log('\n=== FASE 3 · Verificacion de reglas de puja ===\n')

// Sesiones reales
// Una corrida anterior se interrumpio antes de su limpieza y dejo un
// vehiculo de pruebas visible en el catalogo publico. Se borran todos
// los que usen la marca reservada antes de empezar.
const { data: rezagados, error: errRezagados } = await admin
  .from('vehiculos')
  .select('id, modelo')
  .eq('marca', 'TEST')

if (!errRezagados && rezagados?.length) {
  await admin.from('vehiculos').delete().eq('marca', 'TEST')
  console.log(`  ${rezagados.length} vehiculo(s) de prueba rezagados eliminados`)
}
console.log('')

const maria = await sesion(CRED.maria.correo, CRED.maria.password)
const carlos = await sesion(CRED.carlos.correo, CRED.carlos.password)
const ana = await sesion(CRED.ana.correo, CRED.ana.password)
check(true, 'sesiones', '3 usuarios de prueba inicia sesion correctamente')

// Vehiculo temporal de pruebas
const { data: temporal, error: errVeh } = await admin
  .from('vehiculos')
  .insert({
    user_id: maria.userId,
    anio: 2024,
    tipo_articulo: 'Automóvil',
    marca: 'TEST',
    modelo: 'PROVEEDOR DE PRUEBAS',
    motor: '2.0L',
    transmision: 'Automática',
    combustible: 'Gasolina',
    tren_manejo: 'FWD',
    num_cilindros: 4,
    nivel_dano: 'verde',
    monto_base: 20000,
    fecha_inicio: new Date(Date.now() - 3600e3).toISOString(),
    fecha_cierre: new Date(Date.now() + 86400e3).toISOString(),
    estado: 'activo',
  })
  .select('id')
  .single()

if (errVeh) {
  console.error('No se pudo crear el vehiculo temporal:', errVeh.message)
  process.exit(1)
}
const id = temporal.id

const ofertar = async (cliente, vehiculoId, monto) => {
  const { error } = await cliente.rpc('fn_registrar_puja', {
    p_vehiculo_id: vehiculoId,
    p_monto: monto,
  })
  return error?.message ?? null
}

const rechazada = async (nombre, cliente, monto, esperado, detalleOk = true) => {
  const msg = await ofertar(cliente, id, monto)
  const acepto = msg === null
  const contiene = msg ? msg.includes(esperado) : false
  check(acepto === false && (contiene || !detalleOk), nombre, acepto ? `ACEPTADA (debia rechazarse)` : `rechazada: ${msg}`)
}

const aceptada = async (nombre, cliente, monto, esperadoActual) => {
  const msg = await ofertar(cliente, id, monto)
  const ok = msg === null
  check(ok, nombre, ok ? `aceptada, oferta actual Q. ${esperadoActual.toLocaleString('es-GT')}` : `RECHAZADA: ${msg}`)
}

// Reglas de puja
console.log('--- Reglas de oferta ---')

await rechazada('bajo el monto base', ana.cliente, 19999, 'minimo')
await aceptada('exactamente el monto base', ana.cliente, 20000, 20000)

await rechazada('menos de +10% sobre la actual', carlos.cliente, 21999, 'minimo')
await aceptada('exactamente +10%', carlos.cliente, 22000, 22000)

await rechazada('sobre su propia subasta', maria.cliente, 24200, 'publicada por ti')
await rechazada('sin iniciar sesion', anon, 24200, 'iniciar sesion')

// Tras la oferta de 22.000 el minimo es 24.200.
await rechazada('por debajo del minimo vigente', ana.cliente, 24199, 'minimo')
await aceptada('oferta valida', ana.cliente, 24200, 24200)

// Tras la oferta de 24.200 el minimo es 26.700.
await rechazada('por debajo del minimo recalculado', carlos.cliente, 26699, 'minimo')
await aceptada('oferta valida del segundo postor', carlos.cliente, 26700, 26700)

// Ventana de tiempo
console.log('\n--- Ventana de tiempo ---')

// Para probar la ventana de tiempo hace falta un postor que NO sea el
// dueno del vehiculo: si coinciden, la regla de subasta propia salta
// antes que la de tiempo y el test no mide lo que cree medir.
const USUARIOS_CON_SESION = [
  { etiqueta: 'maria', s: maria },
  { etiqueta: 'carlos', s: carlos },
  { etiqueta: 'ana', s: ana },
]

async function buscarPorEstado(estado) {
  const { data: enEseEstado } = await admin
    .from('vw_inventario')
    .select('id')
    .eq('estado_calculado', estado)

  for (const fila of enEseEstado ?? []) {
    const { data: dueno } = await admin
      .from('vehiculos')
      .select('user_id')
      .eq('id', fila.id)
      .maybeSingle()
    if (!dueno) continue
    const postor = USUARIOS_CON_SESION.find((p) => p.s.userId !== dueno.user_id)
    if (postor) return { id: fila.id, postor }
  }
  return null
}

const cerrada = await buscarPorEstado('desierta')
if (cerrada) {
  const msg = await ofertar(cerrada.postor.s.cliente, cerrada.id, 50000)
  check(
    !!msg && msg.includes('cerrada'),
    'oferta en subasta ya cerrada',
    msg ? `rechazada (postor: ${cerrada.postor.etiqueta}): ${msg}` : 'ACEPTADA (error)',
  )
} else {
  check(false, 'oferta en subasta ya cerrada', 'no hay subasta desierta de prueba')
}

const programada = await buscarPorEstado('programada')
if (programada) {
  const msg = await ofertar(programada.postor.s.cliente, programada.id, 90000)
  check(
    !!msg && msg.includes('aun no ha comenzado'),
    'oferta antes de empezar',
    msg ? `rechazada (postor: ${programada.postor.etiqueta}): ${msg}` : 'ACEPTADA (error)',
  )
} else {
  check(false, 'oferta antes de empezar', 'no hay subasta programada de prueba')
}

// Estado personal y anonimato
console.log('\n--- Estado personal y anonimato ---')

const { data: eAna } = await ana.cliente.rpc('fn_estado_subasta', { p_vehiculo_id: id })
const { data: eCarlos } = await carlos.cliente.rpc('fn_estado_subasta', { p_vehiculo_id: id })
const { data: eMaria } = await maria.cliente.rpc('fn_estado_subasta', { p_vehiculo_id: id })

// La ultima oferta aceptada fue la de carlos por 26.700.
const ULTIMA = 26700

check(
  Number(eAna?.monto_actual) === ULTIMA,
  'monto actual visible',
  `Q. ${eAna?.monto_actual}`,
)
check(eCarlos?.soy_ganador === true, 'carlos va ganando', `soy_ganador=${eCarlos?.soy_ganador}`)
check(eAna?.soy_ganador === false, 'ana ya no va ganando', `soy_ganador=${eAna?.soy_ganador}`)
check(Number(eCarlos?.mi_oferta) === ULTIMA, 'carlos ve su propia oferta', `Q. ${eCarlos?.mi_oferta}`)
check(Number(eAna?.mi_oferta) === 24200, 'ana ve su oferta superada', `Q. ${eAna?.mi_oferta}`)
check(eMaria?.soy_ganador === false, 'la duena no va ganando', `soy_ganador=${eMaria?.soy_ganador}`)
// El minimo se deriva del monto actual, no de un numero fijo en el test:
// si el motor cambia el redondeo, esto lo detecta en vez de romperse.
const minimoEsperado = Math.ceil((ULTIMA * 1.1) / 100) * 100
check(
  Number(eAna?.monto_minimo) === minimoEsperado,
  'monto minimo recalculado en servidor',
  `Q. ${eAna?.monto_minimo} (esperado Q. ${minimoEsperado})`,
)

const { data: pujasVistas, error: errPujas } = await ana.cliente.from('pujas').select('*').limit(5)
check(
  !!errPujas || (pujasVistas ?? []).length === 0,
  'nadie puede leer la tabla pujas',
  errPujas
    ? `bloqueado (${errPujas.code}): ni el propio postor ve la identidad de los demas`
    : '0 filas devueltas',
)

// Difusion en tiempo real
console.log('\n--- Difusion en tiempo real ---')

const canal = admin.channel(`subasta:${id}`)

// Minimo vigente: 26.700 + 10% = 29.400. Ana es la unica que puede
// ofertar de nuevo (carlos ya va ganando y maria es la duena).
const OFERTA_EN_VIVO = 29400

const recibido = await new Promise((resolve) => {
  const timer = setTimeout(() => resolve(null), 12000)
  canal
    .on('broadcast', { event: 'subasta' }, (mensaje) => {
      clearTimeout(timer)
      resolve(mensaje.payload)
    })
    .subscribe((estado) => {
      if (estado === 'SUBSCRIBED') {
        // Al suscribirse ya se puede ofertar.
        setTimeout(() => ofertar(ana.cliente, id, OFERTA_EN_VIVO), 300)
      }
      if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') {
        clearTimeout(timer)
        resolve({ error: estado })
      }
    })
})

await admin.removeChannel(canal)

if (recibido?.error) {
  check(false, 'evento en vivo sin F5', `suscripcion fallo: ${recibido.error}`)
} else if (!recibido) {
  check(false, 'evento en vivo sin F5', 'pasaron 12s sin recibir el broadcast del trigger')
} else {
  check(
    Number(recibido.monto_actual) === OFERTA_EN_VIVO,
    'evento en vivo sin F5',
    `llego monto_actual=${recibido.monto_actual} por WebSocket`,
  )
  check(
    !('user_id' in recibido) && !('userId' in recibido),
    'el evento NO revela el postor',
    Object.keys(recibido).join(', '),
  )
}

// Limpieza
await admin.from('vehiculos').delete().eq('id', id)

// Informe
console.log('')
for (const r of resultados) {
  console.log(`  ${r.ok ? 'OK   ' : 'FALLA'} ${r.nombre.padEnd(36)} ${r.detalle}`)
}
const fallas = resultados.filter((r) => !r.ok).length
console.log(`\n  ${fallas === 0 ? 'TODO OK' : `${fallas} FALLA(S)`} · ${resultados.length} comprobaciones\n`)
console.log(`  Vehiculo temporal eliminado.\n`)
process.exit(fallas > 0 ? 1 : 0)