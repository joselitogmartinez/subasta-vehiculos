// Prueba el flujo real de pujar en un navegador: iniciar sesion con un
// usuario de prueba, entrar a una subasta activa y ejecutar la accion de
// ofertar.
//
// Los dos fallos que tumbaron el sitio (useCallback y minimoAlcanzado)
// vivian justo en esta pantalla y solo se veian con sesion iniciada, asi
// que un recorrido sin sesion no los detecta.
//
// Usa Chrome headless con depuracion remota para leer los errores de la
// consola. No modifica datos: la puja se intercepta y se cancela antes
// de llegar al servidor.
//
// Uso: node scripts/verify-puja-navegador.mjs

import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const CHROME =
  process.env.CHROME_PATH ??
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const BASE = process.env.SITIO_URL ?? 'https://subasta-vehiculos-faty.vercel.app'
const CORREO = 'maria@subasta.com'
const PASSWORD = 'Subasta2026!'

console.log('\n=== Verificacion del panel de puja en navegador ===\n')
console.log(`  sitio: ${BASE}\n`)

const perfil = await mkdtemp(path.join(tmpdir(), 'chrome-puja-'))
const puerto = 9222

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${puerto}`,
    `--user-data-dir=${perfil}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
)

process.on('exit', () => chrome.kill())

// Se espera a que el puerto de depuracion responda.
let ws = null
for (let intento = 0; intento < 40 && !ws; intento++) {
  await new Promise((r) => setTimeout(r, 500))
  try {
    const info = await fetch(`http://127.0.0.1:${puerto}/json/list`)
    const paginas = await info.json()
    const objetivo = paginas.find((p) => p.type === 'page')
    if (objetivo?.webSocketDebuggerUrl) ws = objetivo.webSocketDebuggerUrl
  } catch {}
}

if (!ws) {
  console.log('  FALLO  no se pudo conectar al navegador\n')
  chrome.kill()
  await rm(perfil, { recursive: true, force: true })
  process.exit(1)
}

// Cliente minimo del protocolo de DevTools.
const socket = new WebSocket(ws)
await once(socket, 'open')

let idMensaje = 0
const pendientes = new Map()
const erroresConsola = []
const peticiones = []

socket.addEventListener('message', (evento) => {
  const mensaje = JSON.parse(evento.data)

  if (mensaje.id && pendientes.has(mensaje.id)) {
    pendientes.get(mensaje.id)(mensaje)
    pendientes.delete(mensaje.id)
  }

  if (mensaje.method === 'Runtime.exceptionThrown') {
    const d = mensaje.params.exceptionDetails
    erroresConsola.push(
      d.exception?.description ?? d.text ?? 'excepcion desconocida',
    )
  }

  if (mensaje.method === 'Runtime.consoleAPICalled' && mensaje.params.type === 'error') {
    erroresConsola.push(
      (mensaje.params.args ?? [])
        .map((a) => a.value ?? a.description ?? '')
        .join(' '),
    )
  }

  // Se registran las peticiones a la API de Supabase:Needed para
  // distinguir un fallo de la app de un fallo de red o de CORS.
  if (mensaje.method === 'Network.responseReceived') {
    const url = mensaje.params.response.url
    if (url.includes('supabase.co')) {
      peticiones.push(`${mensaje.params.response.status} ${url.replace(/^https:\/\/[^/]+/, '')}`)
    }
  }
  if (mensaje.method === 'Network.loadingFailed') {
    peticiones.push(`FALLO ${mensaje.params.errorText}`)
  }
})

function enviar(method, params = {}) {
  const id = ++idMensaje
  return new Promise((resolve) => {
    pendientes.set(id, resolve)
    socket.send(JSON.stringify({ id, method, params }))
  })
}

const evaluar = async (expresion) => {
  const r = await enviar('Runtime.evaluate', {
    expression: expresion,
    awaitPromise: true,
    returnByValue: true,
  })
  return r.result?.result?.value
}

await enviar('Runtime.enable')
await enviar('Page.enable')
await enviar('Network.enable')

async function ir(url, espera = 3500) {
  await enviar('Page.navigate', { url })
  await new Promise((r) => setTimeout(r, espera))
}

const resultados = []
const check = (ok, nombre, detalle) => resultados.push({ ok: !!ok, nombre, detalle })

// ------------------------------------------------------------------
// 1. Iniciar sesion
// ------------------------------------------------------------------
await ir(`${BASE}/login`)

const inicioOk = await evaluar(`
  (() => {
    const campos = document.querySelectorAll('input')
    const correo = [...campos].find((c) => c.type === 'email' || c.name === 'correo')
    const clave = [...campos].find((c) => c.type === 'password')
    if (!correo || !clave) return 'no se encontraron los campos'
    const fijar = (el, valor) => {
      const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set
      setter.call(el, valor)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    fijar(correo, ${JSON.stringify(CORREO)})
    fijar(clave, ${JSON.stringify(PASSWORD)})
    const boton = [...document.querySelectorAll('button')].find((b) =>
      /entrar/i.test(b.textContent),
    )
    if (!boton) return 'no se encontro el boton entrar'
    boton.click()
    return 'ok'
  })()
`)

check(inicioOk === 'ok', 'formulario de login', inicioOk === 'ok' ? 'campos llenados' : inicioOk)
await new Promise((r) => setTimeout(r, 6000))

// Tras el clic, Supabase guarda la sesion y la SPA navega sola.
//
// Se usa textContent y no innerText: en Chrome headless el viewport
// ronda los 800px, por debajo del breakpoint de 900px, asi que el panel
// del navbar queda en display:none (menu movil) y innerText no devuelve
// nada de ahi. Con textContent el texto se lee igual.
//
// El exito del login se juzga por haber salido de /login y por que el
// navbar muestre los enlaces de sesion, no por un texto suelto: asi no
// depende de acentos ni de como este compuesto el menu.
const sesionActiva = await evaluar(`
  (() => {
    const contenido = document.body.textContent || ''
    return JSON.stringify({
      enLogin: location.pathname.startsWith('/login'),
      conSesion: /Mis publicaciones/.test(contenido) && !/Crear cuenta gratis/.test(contenido),
      ruta: location.pathname,
    })
  })()
`)

const estadoSesion = JSON.parse(sesionActiva)
check(
  !estadoSesion.enLogin && estadoSesion.conSesion,
  'sesion iniciada',
  `ruta=${estadoSesion.ruta}, enlaces de sesion=${estadoSesion.conSesion}`,
)

// ------------------------------------------------------------------
// 2. Entrar a una subasta activa
// ------------------------------------------------------------------
await ir(`${BASE}/`, 4000)

// Se busca una subasta activa que NO sea del usuario conectado: el
// servidor no permite ofertar en una subasta propia, y la pantalla
// muestra otro mensaje en vez del formulario.
//
// La eleccion se hace con vw_vehiculos y no con vw_inventario porque
// vw_inventario no expone es_mio: la consulta debe ir por el mismo
// camino que usa la vista de detalle.
const sesionNode = await fetch('https://qyoavhmuaxzlndhctvik.supabase.co/auth/v1/token?grant_type=password', {
  method: 'POST',
  headers: {
    apikey: 'sb_publishable_IOiWRx8mdQv-K3cpsIVg6w_CgPFW88w',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email: CORREO, password: PASSWORD }),
}).then((r) => r.json())

const eleccion = await fetch(
  'https://qyoavhmuaxzlndhctvik.supabase.co/rest/v1/vw_vehiculos?select=id,marca,modelo,es_mio&estado_calculado=eq.activa',
  {
    headers: {
      apikey: 'sb_publishable_IOiWRx8mdQv-K3cpsIVg6w_CgPFW88w',
      Authorization: `Bearer ${sesionNode.access_token}`,
    },
  },
).then((r) => r.json())

const elegida = (Array.isArray(eleccion) ? eleccion : []).find((v) => v.es_mio === false)
const idVehiculo = elegida?.id ?? null

check(
  !!sesionNode.access_token,
  'credenciales de prueba validas',
  sesionNode.access_token ? `sesion obtenida para ${CORREO}` : 'supabase rechazo las credenciales',
)
check(
  !!idVehiculo,
  'subasta activa de otro usuario',
  idVehiculo ? `${elegida.marca} ${elegida.modelo}` : 'ninguna disponible',
)

if (idVehiculo) {
  await ir(`${BASE}/vehiculo/${idVehiculo}`, 5000)

// A partir de aqui las comprobaciones de texto usan textContent: el
// viewport de Chrome headless esta por debajo del breakpoint movil y
// innerText omite lo que esta oculto por CSS.
const panel = await evaluar(`
  (() => {
    const t = document.body.textContent || ''
    return {
      tieneFormulario: !!document.querySelector('input[inputmode="numeric"]'),
      muestraMinimo: /Oferta minima/i.test(t),
      muestraEstado: /Oferta actual/i.test(t),
      aviso: (t.match(/Se el primero|Aun no has ofertado|Vas ganando|ha sido superada|Esta subasta es tu/i) || ['ninguno'])[0],
      textoBoton: (([...document.querySelectorAll('button')].find((b) => /Ofertar/i.test(b.textContent)) || {}).textContent || 'no').trim(),
      minimo: (t.match(/Q[\\s\\u00a0]?[\\d,]+/g) || []).slice(0, 3).join(' | '),
    }
  })()
`)

  check(panel.tieneFormulario === true, 'panel de puja visible', panel.tieneFormulario ? 'campo de oferta presente' : 'no se ve el formulario')
  check(panel.muestraMinimo === true, 'muestra el monto minimo', panel.minimo || 'no aparece')
  check(panel.muestraEstado === true, 'muestra el estado de la subasta', panel.aviso)
  check(/Ofertar/.test(panel.textoBoton), 'boton de ofertar', `"${panel.textoBoton}"`)

  // El boton debe estar deshabilitado con el campo vacio: no basta con
  // que se vea, tiene que ser usable.
  const botonActivo = await evaluar(`
    (() => {
      const b = [...document.querySelectorAll('button')].find((x) => /Ofertar/i.test(x.textContent))
      return b ? !b.disabled : null
    })()
  `)
  check(botonActivo === false, 'boton bloqueado sin monto', `disabled=${botonActivo}`)

  // Con un monto valido debe habilitarse. No se llega a ofertar.
  await evaluar(`
    (() => {
      const campo = document.querySelector('input[inputmode="numeric"]')
      if (!campo) return false
      const valor = ((document.body.textContent || '').match(/Oferta minima\\s*Q[\\s\\u00a0]?([\\d,]+)/) || [])[1]
      if (!valor) return false
      const monto = Number(valor.replace(/,/g, ''))
      const setter = Object.getOwnPropertyDescriptor(campo.constructor.prototype, 'value').set
      setter.call(campo, String(monto))
      campo.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()
  `)
  await new Promise((r) => setTimeout(r, 900))

  const habilitado = await evaluar(`
    (() => {
      const b = [...document.querySelectorAll('button')].find((x) => /Ofertar/i.test(x.textContent))
      return b ? !b.disabled : null
    })()
  `)
  check(habilitado === true, 'boton habilitado con monto valido', `disabled=${habilitado}`)

  // ------------------------------------------------------------------
  // 3. Errores de JavaScript acumulados
  // ------------------------------------------------------------------
  const referencias = erroresConsola.filter((e) => /is not defined/i.test(e))
  const otros = erroresConsola.filter((e) => !/is not defined/i.test(e))

  check(
    referencias.length === 0,
    'sin ReferenceError en la consola',
    referencias.length ? referencias[0].slice(0, 90) : 'ninguno',
  )
  check(
    otros.length === 0,
    'sin otros errores de consola',
    otros.length ? otros[0].slice(0, 90) : 'ninguno',
  )
}

socket.close()

// Chrome mantiene archivos del perfil abiertos unos instantes despues
// de cerrarse, y borrarlos mientras estan en uso revienta con EBUSY. Se
// espera a que salga y, si aun asi falla, el perfil se deja en su
// lugar: es un directorio temporal del sistema, no del repositorio.
chrome.kill()
await new Promise((r) => setTimeout(r, 2500))
await rm(perfil, { recursive: true, force: true }).catch(() => {})

console.log('\n  --- peticiones a Supabase hechas por el navegador ---')
for (const p of [...new Set(peticiones)].slice(0, 20)) console.log(`  ${p}`)
console.log('  --- fin ---\n')

console.log('')
for (const r of resultados) {
  console.log(`  ${r.ok ? 'OK   ' : 'FALLA'} ${r.nombre.padEnd(34)} ${r.detalle}`)
}
const fallas = resultados.filter((r) => !r.ok).length
console.log(`\n  ${fallas === 0 ? 'TODO OK' : `${fallas} FALLA(S)`} · ${resultados.length} comprobaciones\n`)
process.exit(fallas === 0 ? 0 : 1)