// Verifica el flujo de registro de punta a punta: signUp -> trigger que
// crea el perfil -> login. Es el criterio S1.2 de la rubrica.
//
// El usuario de prueba se crea y se borra al terminar, para no dejar
// basura en el proyecto.
//
// Uso: npm run db:verify-registro

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local', quiet: true })

const URL_SUPABASE = process.env.VITE_SUPABASE_URL
const PUBLISHABLE = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const SECRET = process.env.SUPABASE_SECRET_KEY

const admin = createClient(URL_SUPABASE, SECRET, { auth: { persistSession: false } })
const navegador = createClient(URL_SUPABASE, PUBLISHABLE, { auth: { persistSession: false } })

// Cliente que nunca autentica. No se puede reutilizar `navegador`: al
// registrarse con confirmacion desactivada, Supabase abre sesion de una,
// asi que ese cliente ya no es anonimo y si puede leer su propio perfil.
// Para comprobar el aislamiento hace falta uno realmente anonimo.
const clienteAnonimo = createClient(URL_SUPABASE, PUBLISHABLE, { auth: { persistSession: false } })

const resultados = []
const check = (ok, nombre, detalle) => resultados.push({ ok: !!ok, nombre, detalle })

// Correo unico por ejecucion para poder repetir la prueba sin limpiar.
const sello = Date.now().toString(36)
const CORREO = `prueba.${sello}@subasta.com`
const PASSWORD = 'Prueba2026Segura'

console.log('\n=== Verificacion del registro de usuarios ===\n')
console.log(`  Correo de la prueba: ${CORREO}\n`)

// ------------------------------------------------------------------
// 1. Registro
// ------------------------------------------------------------------
const { data: registro, error: errRegistro } = await navegador.auth.signUp({
  email: CORREO,
  password: PASSWORD,
  options: {
    data: { nombre: 'Prueba', apellido: 'Automatica', telefono: '+502 5555 9999' },
  },
})

if (errRegistro) {
  check(false, 'registro de usuario', errRegistro.message)
} else {
  check(true, 'registro de usuario', `creado: ${registro.user.id.slice(0, 8)}...`)
}

const userId = registro?.user?.id
let haySesionInmediata = false

if (userId) {
  haySesionInmediata = !!registro.session
  check(
    haySesionInmediata,
    'sesion abierta al registrarse',
    haySesionInmediata
      ? 'sin pedir confirmacion de correo'
      : 'el proyecto exige confirmar correo antes de iniciar sesion',
  )

  // El trigger corre AFTER INSERT sobre auth.users: puede tardar un poco.
  await new Promise((r) => setTimeout(r, 700))

  // El anonimo no puede leer profiles ajenas, asi que se consulta con el
  // rol de servicio para comprobar lo que hay realmente en la tabla.
  const { data: fila, error: errFila } = await admin
    .from('profiles')
    .select('id, nombre, apellido, telefono, correo')
    .eq('id', userId)
    .maybeSingle()

  if (errFila) {
    check(false, 'trigger creo el perfil', errFila.message)
  } else if (!fila) {
    check(false, 'trigger creo el perfil', 'no hay fila en profiles para ese usuario')
  } else {
    check(true, 'trigger creo el perfil', `${fila.nombre} ${fila.apellido} · ${fila.telefono}`)
    check(fila.correo === CORREO, 'correo sincronizado', fila.correo)
    check(
      fila.nombre === 'Prueba' &&
        fila.apellido === 'Automatica' &&
        fila.telefono === '+502 5555 9999',
      'metadatos copiados al perfil',
      `${fila.nombre} / ${fila.apellido} / ${fila.telefono}`,
    )
  }
}

// ------------------------------------------------------------------
// 2. Sin sesion no se lee ningun perfil, ni siquiera el propio
// ------------------------------------------------------------------
const { data: ajeno, error: errAjeno } = await clienteAnonimo
  .from('profiles')
  .select('id')
  .limit(5)

check(
  !!errAjeno || (ajeno ?? []).length === 0,
  'anonimo no ve ningun perfil',
  errAjeno ? `bloqueado (${errAjeno.code})` : '0 filas devueltas',
)

// ------------------------------------------------------------------
// 3. Inicio de sesion
// ------------------------------------------------------------------
const clienteLogin = createClient(URL_SUPABASE, PUBLISHABLE, { auth: { persistSession: false } })
const { data: sesion, error: errLogin } = await clienteLogin.auth.signInWithPassword({
  email: CORREO,
  password: PASSWORD,
})

check(!errLogin && !!sesion.session, 'inicio de sesion correcto', errLogin?.message ?? 'sesion abierta')

// Con sesion, el usuario si puede leer su propio perfil.
if (sesion?.session) {
  const { data: propio } = await clienteLogin
    .from('profiles')
    .select('nombre, apellido')
    .maybeSingle()

  check(
    propio?.nombre === 'Prueba',
    'usuario lee su propio perfil',
    propio ? `${propio.nombre} ${propio.apellido}` : 'no devolvio fila',
  )
}

// ------------------------------------------------------------------
// 4. Contrasena incorrecta
// ------------------------------------------------------------------
const clienteMalo = createClient(URL_SUPABASE, PUBLISHABLE, { auth: { persistSession: false } })
const { error: errMalo } = await clienteMalo.auth.signInWithPassword({
  email: CORREO,
  password: 'EstaNoEsLaContrasena1',
})

check(!!errMalo, 'contrasena incorrecta rechazada', errMalo?.message ?? 'ACEPTO (error)')

// ------------------------------------------------------------------
// Limpieza
// ------------------------------------------------------------------
if (userId) {
  await admin.auth.admin.deleteUser(userId)
  console.log('\n  Usuario de prueba eliminado.')
}

// ------------------------------------------------------------------
for (const r of resultados) {
  console.log(`  ${r.ok ? 'OK   ' : 'FALLA'} ${r.nombre.padEnd(32)} ${r.detalle}`)
}
const fallas = resultados.filter((r) => !r.ok).length
console.log(`\n  ${fallas === 0 ? 'TODO OK' : `${fallas} FALLA(S)`} · ${resultados.length} comprobaciones\n`)
process.exit(fallas === 0 ? 0 : 1)