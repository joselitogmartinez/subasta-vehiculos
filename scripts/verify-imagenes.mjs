// Comprobacion de que las imagenes subidas al bucket responden de verdad.
// Una foto rota en la galeria se ve durante la evaluacion, asi que se
// comprueba una muestra real con una peticion HTTP, no solo que el
// registro exista en la base de datos.
//
// Uso: node scripts/verify-imagenes.mjs

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local', quiet: true })

const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})

console.log('\n=== Verificacion de imagenes en Storage ===\n')

const { data: vehiculos, error } = await admin.from('vw_vehiculos').select('id, marca, modelo, fotos')
if (error) {
  console.error('No se pudo leer el inventario:', error.message)
  process.exit(1)
}

let todoOk = true
let total = 0
let rotas = 0

for (const v of vehiculos) {
  const fotos = v.fotos ?? []
  const malas = []

  for (const f of fotos) {
    total++
    try {
      const r = await fetch(f.url)
      if (!r.ok) {
        rotas++
        malas.push(`HTTP ${r.status}`)
      }
    } catch (e) {
      rotas++
      malas.push(e.message.slice(0, 30))
    }
  }

  const buenas = fotos.length - malas.length
  const etiqueta = `${v.marca} ${v.modelo}`
  console.log(
    `  ${buenas >= 5 ? 'OK   ' : 'FALLA'} ${etiqueta.padEnd(26)} ${buenas}/${fotos.length} responden`,
  )
  if (malas.length) console.log(`         fallan: ${malas.join(', ')}`)
  if (buenas < 5) todoOk = false
}

console.log(`\n  Imagenes comprobadas: ${total}`)
console.log(`  Imagenes rotas:       ${rotas}`)
console.log(
  `\n  ${todoOk ? 'TODAS las galerias tienen 5+ imagenes accesibles' : 'HAY GALERIAS INCOMPLETAS'}\n`,
)
process.exit(todoOk ? 0 : 1)