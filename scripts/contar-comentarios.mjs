// Cuenta las lineas de comentario por zona para medir la reduccion.
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

const zonas = [
  { nombre: 'src', dir: 'src', ext: ['.jsx', '.js'] },
  { nombre: 'scripts', dir: 'scripts', ext: ['.mjs'] },
  { nombre: 'supabase', dir: 'supabase', ext: ['.sql'] },
  { nombre: 'raiz', dir: '.', ext: ['.js', '.json'], soloRaiz: true },
]

const esComentario = (l) => {
  const t = l.trim()
  return (
    t.startsWith('//') ||
    t.startsWith('/*') ||
    t.startsWith('*') ||
    t.startsWith('*/') ||
    t.startsWith('--')
  )
}

async function recorrer(dir, ext, soloRaiz = false) {
  const encontrados = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const completa = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!soloRaiz) encontrados.push(...(await recorrer(completa, ext)))
      continue
    }
    if (ext.some((x) => e.name.endsWith(x))) encontrados.push(completa)
  }
  return encontrados
}

console.log('\n=== Comentarios por zona ===\n')

let granTotalCom = 0
let granTotalLineas = 0

for (const z of zonas) {
  const archivos = await recorrer(path.join(raiz, z.dir), z.ext, z.soloRaiz)
  let total = 0
  let com = 0
  let sep = 0

  for (const a of archivos) {
    const lineas = (await readFile(a, 'utf8')).split('\n')
    total += lineas.length
    for (const l of lineas) {
      if (esComentario(l)) {
        com++
        if (/^\s*(\/\/|--)\s*-{5,}/.test(l)) sep++
      }
    }
  }

  granTotalCom += com
  granTotalLineas += total
  const pct = total ? ((com / total) * 100).toFixed(1) : '0.0'
  console.log(
    `  ${z.nombre.padEnd(11)} ${String(total).padStart(5)} lineas  ${String(com).padStart(4)} com  ${String(pct).padStart(5)}%  (${sep} separadores)`,
  )
}

console.log(
  `\n  TOTAL ${String(granTotalLineas).padStart(5)} lineas  ${String(granTotalCom).padStart(4)} com  ${((granTotalCom / granTotalLineas) * 100).toFixed(1)}%\n`,
)