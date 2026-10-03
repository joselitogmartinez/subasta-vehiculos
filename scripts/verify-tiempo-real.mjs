// Verifica el motor de subasta en vivo simulando dos navegadores:
// uno mira la pantalla (suscribido al canal) y otro puja desde su cuenta.
// Comprueba que el monto llega por WebSocket y que la deduccion de badges
// que hace la interfaz responde bien, sin necesitar identidades.
//
// Uso: npm run db:verify-tiempo-real

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { situacionPostor, sugerenciasPuja, parsearMonto } from '../src/lib/subasta.js'

config({ path: '.env.local', quiet: true })

const URL_SUPABASE = process.env.VITE_SUPABASE_URL
const PUBLISHABLE = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const SECRET = process.env.SUPABASE_SECRET_KEY

const admin = createClient(URL_SUPABASE, SECRET, { auth: { persistSession: false } })

const resultados = []
const check = (ok, nombre, detalle) => resultados.push({ ok: !!ok, nombre, detalle })

// Sesiones, una por "navegador"
async function navegador(correo, password) {
  const cliente = createClient(URL_SUPABASE, PUBLISHABLE, { auth: { persistSession: false } })
  const { data, error } = await cliente.auth.signInWithPassword({ email: correo, password })
  if (error) throw new Error(`sesion de ${correo}: ${error.message}`)
  return { cliente, userId: data.user.id }
}

console.log('\n=== FASE 6 · Verificacion de subasta en tiempo real ===\n')

// Logica pura del cliente (mismas funciones que usa la interfaz)
console.log('--- Deduccion del indicador de estado ---')

const caso = (etiqueta, entrada, esperadoTexto) => {
  const r = situacionPostor(entrada)
  check(
    r.texto.includes(esperadoTexto),
    etiqueta,
    `tono=${r.tono} · "${r.texto}"`,
  )
}

caso(
  'sin pujas: se el primero',
  { estado: 'activa', totalPujas: 0, montoActual: 0, miOferta: null, autenticado: true },
  'primero en ofertar',
)
caso(
  'usuario conectado sin ofertar',
  { estado: 'activa', totalPujas: 2, montoActual: 22000, miOferta: null, autenticado: true },
  'Aun no has ofertado',
)
caso(
  'su oferta es la vigente: ganando',
  { estado: 'activa', totalPujas: 2, montoActual: 22000, miOferta: 22000, autenticado: true },
  'Vas ganando',
)
caso(
  'otra oferta la supero',
  { estado: 'activa', totalPujas: 3, montoActual: 24200, miOferta: 22000, autenticado: true },
  'ha sido superada',
)
caso(
  'anonimo ve el cierre, no el formulario',
  { estado: 'activa', totalPujas: 2, montoActual: 22000, miOferta: null, autenticado: false },
  'Inicia sesion',
)
caso(
  'el dueno no puja en su subasta',
  { estado: 'activa', totalPujas: 2, montoActual: 22000, miOferta: null, autenticado: true, esMio: true },
  'subasta es tuya',
)
caso(
  'subasta desierta',
  { estado: 'desierta', totalPujas: 0, montoActual: 0, miOferta: null, autenticado: true },
  'desierta',
)
caso(
  'subasta vendida',
  { estado: 'vendida', totalPujas: 3, montoActual: 30000, miOferta: null, autenticado: true },
  'vendida',
)

console.log('--- Sugerencias y parseo de montos ---')

const sug = sugerenciasPuja(24200, null)
check(
  sug.length > 0 && sug[0].monto === 24200 && sug.every((s) => s.monto >= 24200),
  'sugerencias arrancan en el minimo y suben',
  sug.map((s) => s.monto).join(' · '),
)
check(
  sugerenciasPuja(24200, 24200)[0].repetida === true,
  'la oferta ya hecha aparece deshabilitada',
  'si',
)
const casosParseo = [
  ['24,200', 24200],
  ['Q. 30,000', 30000],
  ['Q 25000', 25000],
  ['$45.500', 45500],
  ['20 000', 20000],
  ['abc', null],
  ['', null],
]
check(
  casosParseo.every(([entrada, esperado]) => parsearMonto(entrada) === esperado),
  'parseo de montos escritos a mano',
  casosParseo.map(([e, x]) => `"${e}"->${x}`).join(' · '),
)

// Flujo real: unVehicle, dos cuentas, WebSocket
console.log('\n--- Flujo real entre dos navegadores ---')

const duena = await navegador('maria@subasta.com', 'Subasta2026!')
const postorA = await navegador('carlos@subasta.com', 'Subasta2026!')
const postorB = await navegador('ana@subasta.com', 'Subasta2026!')

const { data: temporal, error: errVeh } = await admin
  .from('vehiculos')
  .insert({
    user_id: duena.userId,
    anio: 2024,
    tipo_articulo: 'Automóvil',
    marca: 'TEST',
    modelo: 'TIEMPO REAL',
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
  check(false, 'vehiculo de prueba creado', errVeh.message)
} else {
  check(true, 'vehiculo de prueba creado', temporal.id.slice(0, 8))

  const id = temporal.id

  // "Navegador de Carlos" se queda mirando la pantalla.
  const recibidosA = []
  const canalA = postorA.cliente.channel(`subasta:${id}`)
  const suscritoA = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), 10000)
    canalA.subscribe((estado) => {
      if (estado === 'SUBSCRIBED') {
        clearTimeout(t)
        resolve(true)
      }
      if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') {
        clearTimeout(t)
        resolve(false)
      }
    })
  })

  if (!suscritoA) {
    check(false, 'navegador 1 se suscribe al canal', 'no se pudo suscribir')
  } else {
    canalA.on('broadcast', { event: 'subasta' }, ({ payload }) => recibidosA.push(payload))
    check(true, 'navegador 1 se suscribe al canal', 'subasta:' + id.slice(0, 8))

    const esperarEvento = async (montoEsperado, ms = 9000) => {
      const limite = Date.now() + ms
      while (Date.now() < limite) {
        const encontrado = recibidosA.find((p) => Number(p.monto_actual) === montoEsperado)
        if (encontrado) return encontrado
        await new Promise((r) => setTimeout(r, 150))
      }
      return null
    }

    // --- Ana oferta primero
    const { error: errA } = await postorB.cliente.rpc('fn_registrar_puja', {
      p_vehiculo_id: id,
      p_monto: 20000,
    })
    check(!errA, 'navegador 2 puja Q. 20,000', errA?.message ?? 'aceptada')

    const evento1 = await esperarEvento(20000)
    check(!!evento1, 'navegador 1 recibe el evento sin recargar', evento1 ? `monto_actual=${evento1.monto_actual}` : 'no llego en 9s')
    check(
      evento1 ? !('user_id' in evento1) && !('userId' in evento1) : false,
      'el evento no revela quien pujo',
      evento1 ? Object.keys(evento1).join(', ') : 'sin evento',
    )

    // Carlos no ha ofertado todavia.
    if (evento1) {
      const s1 = situacionPostor({
        estado: evento1.estado,
        totalPujas: evento1.total_pujas,
        montoActual: evento1.monto_actual,
        miOferta: null,
        autenticado: true,
      })
      check(
        s1.texto.includes('Aun no has ofertado'),
        'navegador 1 ve que aun no ofertó',
        `"${s1.texto}"`,
      )
    }

    // --- Carlos puja y pasa a ganar
    const { error: errB } = await postorA.cliente.rpc('fn_registrar_puja', {
      p_vehiculo_id: id,
      p_monto: 22000,
    })
    check(!errB, 'navegador 1 puja Q. 22,000', errB?.message ?? 'aceptada')

    const evento2 = await esperarEvento(22000)
    check(!!evento2, 'navegador 1 ve su propia oferta en pantalla', evento2 ? `monto_actual=${evento2.monto_actual}` : 'no llego')

    if (evento2) {
      const s2 = situacionPostor({
        estado: evento2.estado,
        totalPujas: evento2.total_pujas,
        montoActual: evento2.monto_actual,
        miOferta: 22000,
        autenticado: true,
      })
      check(s2.tono === 'verde' && s2.texto.includes('Vas ganando'), 'indicador VERDE: vas ganando', `"${s2.texto}"`)
    }

    // --- Ana supera a Carlos
    const { error: errC } = await postorB.cliente.rpc('fn_registrar_puja', {
      p_vehiculo_id: id,
      p_monto: 24200,
    })
    check(!errC, 'navegador 2 supera con Q. 24,200', errC?.message ?? 'aceptada')

    const evento3 = await esperarEvento(24200)
    check(!!evento3, 'navegador 1 recibe la superacion en vivo', evento3 ? `monto_actual=${evento3.monto_actual}` : 'no llego')

    if (evento3) {
      const s3 = situacionPostor({
        estado: evento3.estado,
        totalPujas: evento3.total_pujas,
        montoActual: evento3.monto_actual,
        miOferta: 22000,
        autenticado: true,
      })
      check(
        s3.tono === 'rojo' && s3.texto.includes('superada'),
        'indicador ROJO: oferta superada',
        `"${s3.texto}"`,
      )
    }

    check(
      recibidosA.length >= 3,
      'navegador 1 recibio los tres eventos',
      `${recibidosA.length} eventos: ${recibidosA.map((p) => p.monto_actual).join(' -> ')}`,
    )

    await postorA.cliente.removeChannel(canalA)
  }

  await admin.from('vehiculos').delete().eq('id', id)
}

console.log('')
for (const r of resultados) {
  console.log(`  ${r.ok ? 'OK   ' : 'FALLA'} ${r.nombre.padEnd(42)} ${r.detalle}`)
}
const fallas = resultados.filter((r) => !r.ok).length
console.log(`\n  ${fallas === 0 ? 'TODO OK' : `${fallas} FALLA(S)`} · ${resultados.length} comprobaciones\n`)
console.log(`  Vehiculo temporal eliminado.\n`)
process.exit(fallas === 0 ? 0 : 1)