import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

config({ path: '.env.local', quiet: true })

const url = process.env.VITE_SUPABASE_URL
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

const anon = createClient(url, publishableKey, { auth: { persistSession: false } })
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})
const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const resultados = []
const check = (cond, nombre, detalle) => resultados.push({ ok: !!cond, nombre, detalle })

await db.connect()

console.log('\n=== FASE 2 · Verificacion de esquema y seguridad ===\n')

// --- Estructura -----------------------------------------------------
const { rows: tablas } = await db.query(`
  SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN ('profiles','vehiculos','fotos_vehiculo','pujas')
   ORDER BY table_name
`)
check(
  tablas.length === 4,
  'tablas',
  `${tablas.length}/4 · ${tablas.map((t) => t.table_name).join(', ')}`,
)

const { rows: vistas } = await db.query(`
  SELECT table_name FROM information_schema.views
   WHERE table_schema = 'public' AND table_name LIKE 'vw_%'
   ORDER BY table_name
`)
check(
  vistas.length === 3,
  'vistas',
  vistas.map((v) => v.table_name).join(', '),
)

const { rows: funciones } = await db.query(`
  SELECT p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname LIKE 'fn_%'
   ORDER BY p.proname
`)
check(
  funciones.length >= 9,
  'funciones',
  `${funciones.length} · ${funciones.map((f) => f.proname).join(', ')}`,
)

const { rows: triggers } = await db.query(`
  SELECT trigger_name, event_object_table FROM information_schema.triggers
   WHERE trigger_schema IN ('public', 'auth')
   ORDER BY trigger_name
`)
check(
  triggers.length >= 4,
  'triggers',
  triggers.map((t) => `${t.trigger_name}(${t.event_object_table})`).join(' '),
)

// --- RLS: la tabla pujas no debe tener ninguna politica --------------
const { rows: politicasPujas } = await db.query(`
  SELECT count(*)::int AS n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'pujas'
`)
check(
  politicasPujas[0].n === 0,
  'pujas sin policies',
  politicasPujas[0].n === 0
    ? '0 policies: identidad de postores inaccesible'
    : `FUGA: ${politicasPujas[0].n} policies`,
)

const { rows: rls } = await db.query(`
  SELECT relname, relrowsecurity FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND relname IN
     ('profiles','vehiculos','fotos_vehiculo','pujas')
   ORDER BY relname
`)
check(
  rls.every((r) => r.relrowsecurity),
  'RLS habilitado',
  rls.map((r) => `${r.relname}:${r.relrowsecurity ? 'si' : 'NO'}`).join(' '),
)

// --- Storage ---------------------------------------------------------
const { data: buckets } = await admin.storage.listBuckets()
const bucket = buckets?.find((b) => b.name === 'vehiculos')
check(
  bucket?.public === true,
  'bucket vehiculos',
  bucket ? `publico=${bucket.public}, max ${Math.round(bucket.file_size_limit / 1024)}KB` : 'NO EXISTE',
)

// --- Comportamiento desde el navegador sin sesion -------------------
const { data: cat, error: errCat } = await anon.from('vw_inventario').select('id').limit(1)
check(
  !errCat && Array.isArray(cat),
  'anon lee catalogo',
  errCat ? errCat.message : 'permitido (modo lectura)',
)

// Denegado por permiso es un resultado MAS fuerte que devolver cero
// filas: significa que la tabla ni siquiera es legible sin sesion.
const { data: pujasAnon, error: errPujas } = await anon.from('pujas').select('*').limit(5)
check(
  !!errPujas || pujasAnon?.length === 0,
  'anon lee pujas',
  errPujas
    ? `bloqueado por permisos (${errPujas.code}): identidad inaccesible`
    : '0 filas devueltas: identidad inaccesible',
)

const { error: errInsert } = await anon.from('pujas').insert({
  vehiculo_id: '00000000-0000-0000-0000-000000000000',
  user_id: '00000000-0000-0000-0000-000000000000',
  monto: 1,
})
check(
  !!errInsert,
  'anon NO puede ofertar',
  errInsert
    ? `bloqueado (${errInsert.code || errInsert.message.slice(0, 60)})`
    : 'FUGA: el anonimo pudo escribir en pujas',
)

const { error: errRpc } = await anon.rpc('fn_registrar_puja', {
  p_vehiculo_id: '00000000-0000-0000-0000-000000000000',
  p_monto: 1,
})
check(
  !!errRpc,
  'anon NO puede usar fn_registrar_puja',
  errRpc ? `bloqueado (${errRpc.code})` : 'FUGA: el anonimo pudo ofertar',
)

const { error: errVeh } = await anon.from('vehiculos').insert({
  user_id: '00000000-0000-0000-0000-000000000000',
  anio: 2020,
})
check(
  !!errVeh,
  'anon NO puede publicar vehiculos',
  errVeh ? `bloqueado (${errVeh.code || errVeh.message.slice(0, 50)})` : 'FUGA',
)

// --- Logica de negocio pura -----------------------------------------
// pg devuelve numeric como string: hay que convertir antes de comparar.
const { rows: minimo } = await db.query(
  `SELECT public.fn_monto_minimo(20000, 0) AS primera,
          public.fn_monto_minimo(20000, 20000) AS segunda,
          public.fn_monto_minimo(20000, 22000) AS tercera`,
)
const { primera, segunda, tercera } = Object.fromEntries(
  Object.entries(minimo[0]).map(([k, v]) => [k, Number(v)]),
)
check(
  primera === 20000 && segunda === 22000 && tercera === 24200,
  'incremento 10%',
  `20.000 -> ${primera} -> ${segunda} -> ${tercera}`,
)

await db.end()

// --- Informe ---------------------------------------------------------
for (const r of resultados) {
  console.log(`  ${r.ok ? 'OK   ' : 'FALLA'} ${r.nombre.padEnd(30)} ${r.detalle}`)
}
const fallas = resultados.filter((r) => !r.ok).length
console.log(`\n  ${fallas === 0 ? 'TODO OK' : `${fallas} FALLA(S)`} · ${resultados.length} comprobaciones\n`)
process.exit(fallas === 0 ? 0 : 1)