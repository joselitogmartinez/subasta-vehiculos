import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local', quiet: true })

const url = process.env.VITE_SUPABASE_URL
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const secretKey = process.env.SUPABASE_SECRET_KEY
const databaseUrl = process.env.DATABASE_URL

const results = []
const ok = (name, detail) => results.push({ pass: true, name, detail })
const bad = (name, detail) => results.push({ pass: false, name, detail })

console.log('\n=== FASE 1 · Prueba de humo de conexion ===\n')

if (!url || !publishableKey || !secretKey || !databaseUrl) {
  console.error('Faltan variables en .env.local:', {
    VITE_SUPABASE_URL: !!url,
    VITE_SUPABASE_PUBLISHABLE_KEY: !!publishableKey,
    SUPABASE_SECRET_KEY: !!secretKey,
    DATABASE_URL: !!databaseUrl,
  })
  process.exit(1)
}

const ref = url.replace('https://', '').split('.')[0]
const region = (databaseUrl.match(/@aws-\d+-([a-z0-9-]+)\.pooler/) || [])[1] || 'desconocida'
console.log(`Proyecto : ${ref}`)
console.log(`Region   : ${region}\n`)

const client = createClient(url, publishableKey, { auth: { persistSession: false } })

// 1. Auth: getSession llega al servidor y confirma que la key es valida.
try {
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  ok('Auth', `sesion consultada correctamente (usuario: ${data.session ? 'con sesion' : 'anonimo'})`)
} catch (e) {
  bad('Auth', e.message)
}

// 2. PostgREST: aun no hay tablas,asi que se espera PGRST205.
try {
  const { error } = await client.from('__verificacion__').select('*').limit(1)
  const code = error?.code ?? ''
  if (!error) ok('PostgREST', 'respondio correctamente')
  else if (code === 'PGRST205') ok('PostgREST', `alcanzable, schema vacio todavia (${code})`)
  else bad('PostgREST', `${code || ''} ${error.message}`)
} catch (e) {
  bad('PostgREST', e.message)
}

// 3. Realtime: el canal debe llegar a SUBSCRIBED por WebSocket.
try {
  const channel = client.channel('verificacion-humo')
  const estado = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout de 15s')), 15000)
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer)
        resolve('SUBSCRIBED')
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer)
        reject(new Error(status))
      }
    })
  })
  await client.removeChannel(channel)
  ok('Realtime', `WebSocket conectado y canal en estado ${estado}`)
} catch (e) {
  bad('Realtime', e.message)
}

// 4. Storage: debe responder el catalogo de buckets.
try {
  const { error } = await client.storage.listBuckets()
  if (!error) ok('Storage', 'endpoint responde')
  else bad('Storage', error.message)
} catch (e) {
  bad('Storage', e.message)
}

// 5. Connection string: solo se valida el formato, no se imprime la contrasena.
const pooler = /pooler\.supabase\.com:5432/.test(databaseUrl)
const sameRef = databaseUrl.includes(ref)
if (pooler && sameRef) ok('DATABASE_URL', 'formato Session pooler valido y apuntando al mismo proyecto')
else bad('DATABASE_URL', `pooler=${pooler} mismoProyecto=${sameRef}`)

console.log('')
for (const r of results) console.log(`  ${r.pass ? 'OK  ' : 'FALLA'} ${r.name.padEnd(13)} ${r.detail}`)
const fallas = results.filter((r) => !r.pass).length
console.log(`\n${fallas === 0 ? 'TODO OK' : `${fallas} FALLA(S)`} · ${results.length} comprobaciones\n`)

process.exit(fallas === 0 ? 0 : 1)