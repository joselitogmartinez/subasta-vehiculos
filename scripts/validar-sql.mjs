// Valida que el SQL de las migraciones siga siendo sintacticamente
// valido despues de haberlo compactado.
//
// Hace falta porque db:migrate omite las migraciones ya aplicadas: si un
// archivo se rompiera al quitarle comentarios, nadie lo ejecutaria nunca
// y el error pasaria desapercibido. Aqui cada archivo se corre dentro
// de una transaccion que se revierte al final, asi que no cambia nada
// pero PostgreSQL lo analiza entero.
//
// Uso: node scripts/validar-sql.mjs

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import pg from 'pg'

config({ path: '.env.local', quiet: true })

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const dir = path.join(raiz, 'supabase', 'migrations')

const cliente = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  application_name: 'validar-sql',
})

await cliente.connect()

console.log('\n=== Validacion de la sintaxis de las migraciones ===\n')

const archivos = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
let fallas = 0

for (const archivo of archivos) {
  const sql = await readFile(path.join(dir, archivo), 'utf8')

  await cliente.query('BEGIN')
  try {
    // Las vistas ya existen en la base real, y CREATE OR REPLACE VIEW no
    // puede cambiar nombres ni el orden de las columnas de una vista
    // existente. Se eliminan primero dentro de la misma transaccion,
    // que al final se revierte: la validacion es de sintaxis, no de
    // resolucion contra objetos que ya existen.
    await cliente.query(`
      DROP VIEW IF EXISTS public.vw_vehiculos;
      DROP VIEW IF EXISTS public.vw_inventario;
      DROP VIEW IF EXISTS public.vw_catalogos;
    `)

    await cliente.query(sql)
    await cliente.query('ROLLBACK')
    console.log(`  OK    ${archivo.padEnd(34)} ${sql.split('\n').length} lineas`)
  } catch (e) {
    await cliente.query('ROLLBACK')
    fallas++
    console.log(`  FALLA ${archivo.padEnd(34)} ${e.message}`)
  }
}

await cliente.end()

console.log(
  `\n  ${fallas === 0 ? 'TODO OK' : `${fallas} FALLA(S)`} · ${archivos.length} migraciones\n`,
)
process.exit(fallas === 0 ? 0 : 1)