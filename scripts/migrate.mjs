import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { config } from 'dotenv'
import pg from 'pg'

config({ path: '.env.local', quiet: true })

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dirMigraciones = path.join(raiz, 'supabase', 'migrations')

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('\nFalta DATABASE_URL en .env.local.')
  process.exit(1)
}

const cliente = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  // El pooler de Supabase exige el cliente de Session mode.
  application_name: 'subastas-migrate',
})

const ERRCODE_FALLA = {
  // Errores que si consideramos motivo para detener la migracion.
  42501: 'permisos insuficientes (falta un GRANT)',
  '42P01': 'objeto inexistente en el esquema public',
}

let fallas = 0

async function aplicar() {
  console.log('\n=== FASE 2 · Migraciones ===\n')

  await cliente.connect()
  console.log('  Conectado a Postgres.')

  await cliente.query(`
    CREATE TABLE IF NOT EXISTS public._migraciones (
      nombre     text PRIMARY KEY,
      aplicado_en timestamptz NOT NULL DEFAULT now()
    )
  `)

  const archivos = (await readdir(dirMigraciones))
    .filter((f) => f.endsWith('.sql'))
    .sort()

  if (archivos.length === 0) {
    console.error('  No hay migraciones en supabase/migrations/')
    process.exit(1)
  }

  const { rows: aplicadas } = await cliente.query('SELECT nombre FROM public._migraciones')
  const yaAplicadas = new Set(aplicadas.map((r) => r.nombre))

  for (const archivo of archivos) {
    if (yaAplicadas.has(archivo)) {
      console.log(`  OMITIDA  ${archivo} (ya aplicada)`)
      continue
    }

    const sql = await readFile(path.join(dirMigraciones, archivo), 'utf8')

    try {
      await cliente.query('BEGIN')
      await cliente.query(sql)
      await cliente.query('INSERT INTO public._migraciones (nombre) VALUES ($1)', [archivo])
      await cliente.query('COMMIT')
      console.log(`  APLICADA  ${archivo}`)
    } catch (error) {
      await cliente.query('ROLLBACK')
      fallas++
      console.log(`  FALLO     ${archivo}`)
      console.log(`            ${error.message}`)
      if (ERRCODE_FALLA[error.code]) console.log(`            -> ${ERRCODE_FALLA[error.code]}`)
      // Las migraciones son ordenadas: si una falla, las siguientes
      // darian error por dependencias. Se detiene aqui.
      break
    }
  }

  // PostgREST cachea el esquema. Sin esto, las funciones nuevas no
  // aparecen en la API hasta reiniciar el servicio.
  try {
    await cliente.query("NOTIFY pgrst, 'reload schema'")
    console.log('\n  Caché de esquema de PostgREST notificado.')
  } catch {
    console.log('\n  Aviso: no se pudo notificar a PostgREST (se recargará solo).')
  }

  const resumen = await cliente.query(`
    SELECT
      (SELECT count(*) FROM public.vehiculos)::int      AS vehiculos,
      (SELECT count(*) FROM public.pujas)::int          AS pujas,
      (SELECT count(*) FROM public.fotos_vehiculo)::int AS fotos,
      (SELECT count(*) FROM public._migraciones)::int   AS migraciones
  `)
  const r = resumen.rows[0]
  console.log(`\n  Migraciones aplicadas : ${r.migraciones}`)
  console.log(`  Tablas                : ${r.vehiculos} vehiculos, ${r.fotos} fotos, ${r.pujas} pujas\n`)

  await cliente.end()
  process.exit(fallas === 0 ? 0 : 1)
}

aplicar().catch(async (e) => {
  console.error('\nError inesperado:', e.message)
  try {
    await cliente.end()
  } catch {}
  process.exit(1)
})